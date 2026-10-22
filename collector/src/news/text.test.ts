import { describe, expect, it } from 'vitest';
import { decodeEntities, toPlainText, truncate } from './text';

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

  it('二重にエスケープされたタグも除く', () => {
    expect(toPlainText('a &amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt; c')).toBe('a bold c');
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
