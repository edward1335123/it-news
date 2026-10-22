import { describe, expect, it } from 'vitest';
import { decodeEntities, toPlainText, truncate } from './text';
import { articleId, cleanUrl, urlKey } from './url';

describe('decodeEntities', () => {
  it('名前・10進・16進の文字参照を戻し、知らないものは残す', () => {
    expect(decodeEntities('a &amp; b &#8217; &#x2019; &hellip; &unknown; &#0;')).toBe(
      'a & b ’ ’ … &unknown; &#0;',
    );
  });
});

describe('toPlainText', () => {
  it('タグ・script を除き、空白をまとめる', () => {
    expect(toPlainText('<p>Hello <b>world</b></p>\n<script>alert(1)</script> <!-- c -->end')).toBe(
      'Hello world end',
    );
  });

  it('エスケープされた HTML もテキストにする', () => {
    expect(toPlainText('&lt;p&gt;It&amp;#8217;s&lt;/p&gt;')).toBe('It’s');
  });

  it('タグでない「<」は残す', () => {
    expect(toPlainText('a < b and c > d')).toBe('a < b and c > d');
  });
});

describe('truncate', () => {
  it('上限を超えたら「…」で切り詰める', () => {
    expect(truncate('abcdef', 6)).toBe('abcdef');
    expect(truncate('abcdefg', 6)).toBe('abcde…');
  });

  it('サロゲートペアの途中で切らない', () => {
    const result = truncate('ab😀cd', 4);
    expect(result).toBe('ab…');
    expect(result.length).toBeLessThanOrEqual(4);
  });
});

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

  it('http/https・www・末尾のスラッシュの違いを同じ記事とみなす', () => {
    const a = cleanUrl('https://www.example.com/news/1/') ?? '';
    const b = cleanUrl('http://example.com/news/1') ?? '';
    expect(urlKey(a)).toBe(urlKey(b));
    expect(articleId(a)).toBe(articleId(b));
    expect(articleId(a)).toMatch(/^[0-9a-f]{16}$/);
    expect(articleId(cleanUrl('https://example.com/news/2') ?? '')).not.toBe(articleId(a));
  });
});
