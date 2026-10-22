import { describe, expect, it } from 'vitest';
import { articleId, cleanUrl, urlKey } from './url';

describe('cleanUrl・urlKey・articleId', () => {
  it('計測用パラメータ・フラグメントを除き、パラメータを並べ替える', () => {
    expect(cleanUrl('https://Example.com/a?utm_source=rss&b=2&a=1&fbclid=x#top')).toBe(
      'https://example.com/a?a=1&b=2',
    );
  });

  it('相対 URL をフィードの URL から解決し、http/https 以外は null にする', () => {
    expect(cleanUrl('/news/1', 'https://example.com/feed.xml')).toBe('https://example.com/news/1');
    expect(cleanUrl('javascript:alert(1)')).toBeNull();
    expect(cleanUrl('not a url')).toBeNull();
  });

  it('news.json のスキーマに通らない URL は null にする', () => {
    expect(cleanUrl('http://1.2.3.4/a')).toBeNull();
    expect(cleanUrl('https://my_host.example.com/')).toBeNull();
    expect(cleanUrl('http://localhost/x')).toBeNull();
    expect(cleanUrl('https://example.com./a')).toBeNull();
  });

  it('http/https・www・末尾のスラッシュの違いを同じ記事とみなす', () => {
    const a = cleanUrl('https://www.example.com/news/1/') ?? '';
    const b = cleanUrl('http://example.com/news/1') ?? '';
    expect(urlKey(a)).toBe(urlKey(b));
    expect(articleId(a)).toBe(articleId(b));
    expect(articleId(a)).toMatch(/^[0-9a-f]{16}$/);
    expect(articleId(cleanUrl('https://example.com/news/2') ?? '')).not.toBe(articleId(a));
  });
});
