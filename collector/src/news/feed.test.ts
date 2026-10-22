import { describe, expect, it } from 'vitest';
import { parseFeed } from './feed';

describe('parseFeed', () => {
  it('RSS 2.0 を読む（CDATA・文字参照・dc:date・guid）', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel>
          <title>Example</title>
          <item>
            <title>It&#8217;s &amp; new</title>
            <link>https://example.com/a?x=1&amp;y=2</link>
            <pubDate>Tue, 20 Oct 2026 14:30:31 +0900</pubDate>
            <description><![CDATA[<p>Hello <b>world</b></p>]]></description>
          </item>
          <item>
            <title>No link</title>
            <guid isPermaLink="true">https://example.com/b</guid>
            <dc:date>2026-10-21T00:00:00Z</dc:date>
          </item>
          <item><title>Dropped: no url</title></item>
        </channel>
      </rss>`;
    expect(parseFeed(xml)).toEqual([
      {
        title: 'It&#8217;s &amp; new',
        url: 'https://example.com/a?x=1&y=2',
        publishedAt: '2026-10-20T05:30:31.000Z',
        summary: '<p>Hello <b>world</b></p>',
      },
      { title: 'No link', url: 'https://example.com/b', publishedAt: '2026-10-21T00:00:00.000Z' },
    ]);
  });

  it('RSS 1.0（RDF）を読む', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"
        xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel rdf:about="https://example.jp/"><title>JP</title></channel>
        <item rdf:about="https://example.jp/1">
          <title>注意喚起</title>
          <link>https://example.jp/1</link>
          <dc:date>2026-10-20T10:00:00+09:00</dc:date>
        </item>
      </rdf:RDF>`;
    expect(parseFeed(xml)).toEqual([
      { title: '注意喚起', url: 'https://example.jp/1', publishedAt: '2026-10-20T01:00:00.000Z' },
    ]);
  });

  it('Atom を読む（rel="alternate" の link を選ぶ）', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title type="html">A &lt;b&gt;bold&lt;/b&gt; title</title>
          <link rel="replies" href="https://example.com/a#comments"/>
          <link rel="alternate" type="text/html" href="https://example.com/a"/>
          <published>2026-10-20T00:00:00Z</published>
          <updated>2026-10-21T00:00:00Z</updated>
          <summary>Short</summary>
        </entry>
        <entry>
          <title>Only href</title>
          <link href="https://example.com/b"/>
          <updated>not a date</updated>
        </entry>
      </feed>`;
    expect(parseFeed(xml)).toEqual([
      {
        title: 'A &lt;b&gt;bold&lt;/b&gt; title',
        url: 'https://example.com/a',
        publishedAt: '2026-10-20T00:00:00.000Z',
        summary: 'Short',
      },
      { title: 'Only href', url: 'https://example.com/b' },
    ]);
  });

  it('Hacker News（hnrss.org）のポイントを読む', () => {
    const xml = `<rss version="2.0"><channel><item>
        <title>Show HN</title><link>https://example.com/x</link>
        <description><![CDATA[<p>Points: 123</p><p># Comments: 45</p>]]></description>
      </item></channel></rss>`;
    expect(parseFeed(xml)[0]?.points).toBe(123);
  });

  it('CISA KEV の JSON を読み、形式の違う項目は捨てる', () => {
    const json = JSON.stringify({
      title: 'CISA Catalog of Known Exploited Vulnerabilities',
      vulnerabilities: [
        {
          cveID: 'CVE-2026-1234',
          vulnerabilityName: 'Example RCE',
          dateAdded: '2026-10-20',
          shortDescription: 'Remote code execution.',
        },
        { cveID: 'invalid', vulnerabilityName: 'x', dateAdded: '2026-10-20' },
      ],
    });
    expect(parseFeed(json)).toEqual([
      {
        title: 'CVE-2026-1234: Example RCE',
        url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-1234',
        publishedAt: '2026-10-20T05:00:00.000Z',
        summary: 'Remote code execution.',
      },
    ]);
  });

  it('フィードでない応答は例外にする', () => {
    expect(() => parseFeed('<!DOCTYPE html><html><body>Not found</body></html>')).toThrow();
    expect(() => parseFeed('{"error": "not kev"}')).toThrow();
  });

  it('DOCTYPE の実体を展開しない', () => {
    const xml = `<?xml version="1.0"?>
      <!DOCTYPE rss [<!ENTITY x "EXPANDED">]>
      <rss version="2.0"><channel><item><title>&x;</title><link>https://example.com/</link></item></channel></rss>`;
    expect(parseFeed(xml)[0]?.title).toBe('&x;');
  });
});
