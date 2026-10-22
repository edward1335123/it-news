import type { Article } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import { mergeArticles, titleKey, titleSimilarity } from './dedupe';

function article(
  overrides: Partial<Article> & Pick<Article, 'id' | 'title' | 'url' | 'source'>,
): Article {
  return {
    lang: 'en',
    publishedAt: '2026-10-20T00:00:00.000Z',
    category: 'security',
    tags: ['sec-vuln'],
    score: 0,
    related: [],
    ...overrides,
  };
}

describe('titleKey・titleSimilarity', () => {
  it('記号・空白・全角半角・大文字小文字を無視する', () => {
    expect(titleKey('ＰＨＰ の脆弱性、「緊急」！')).toBe('phpの脆弱性緊急');
    expect(titleSimilarity('PHP2Shell Exploitation', 'php2shell  exploitation!')).toBe(1);
  });

  it('同じ話題の別媒体の見出しは似ていると判定し、無関係な見出しは判定しない', () => {
    expect(
      titleSimilarity(
        'Amazon says PHP2Shell exploitation began 4 days before patches',
        'PHP2Shell Exploitation Started Days Before Patches',
      ),
    ).toBeGreaterThanOrEqual(0.6);
    expect(
      titleSimilarity(
        '「ふるさとチョイス」に不正アクセス、4,454,097件の会員情報が流出',
        '「ふるさとチョイス」に不正アクセス - 会員情報が流出',
      ),
    ).toBeGreaterThanOrEqual(0.6);
    expect(titleSimilarity('Introducing Mistral Large 4', 'Introducing Falcon ASR')).toBeLessThan(
      0.6,
    );
  });
});

describe('mergeArticles', () => {
  const a = article({
    id: 'a',
    title: 'Amazon says PHP2Shell exploitation began 4 days before patches',
    url: 'https://www.bleepingcomputer.com/news/php2shell/',
    source: 'bleepingcomputer',
    publishedAt: '2026-10-20T00:00:00.000Z',
  });
  const b = article({
    id: 'b',
    title: 'PHP2Shell Exploitation Started Days Before Patches',
    url: 'https://www.securityweek.com/php2shell/',
    source: 'securityweek',
    publishedAt: '2026-10-20T03:00:00.000Z',
    tags: ['sec-vuln', 'sec-advisory'],
  });

  it('正規化 URL が同じ記事は1件にする', () => {
    const copy = { ...a, id: 'a2', url: 'http://bleepingcomputer.com/news/php2shell' };
    expect(mergeArticles([], [a, copy])).toEqual([a]);
  });

  it('タイトルが似た別の情報源の記事は、先に公開された記事の related にまとめる', () => {
    const merged = mergeArticles([], [b, a]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'a',
      tags: ['sec-vuln', 'sec-advisory'],
      related: [{ source: 'securityweek', url: b.url }],
    });
  });

  it('前回の記事やまとめ済みの報道と同じ URL は追加しない', () => {
    const previous = mergeArticles([], [a, b]);
    expect(mergeArticles(previous, [a, b])).toEqual(previous);
  });

  it('前回の記事に今回の似た記事をまとめる', () => {
    const merged = mergeArticles([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.related).toEqual([{ source: 'securityweek', url: b.url }]);
  });

  it('同じ情報源・別の言語・離れた日時・短いタイトルの記事はまとめない', () => {
    const sameSource = { ...b, source: 'bleepingcomputer' };
    const otherLang = { ...b, lang: 'ja' as const };
    const later = { ...b, publishedAt: '2026-10-27T00:00:00.000Z' };
    for (const other of [sameSource, otherLang, later]) {
      expect(mergeArticles([], [a, other])).toHaveLength(2);
    }
    const short1 = article({
      id: 's1',
      title: 'Daily News',
      url: 'https://x.example/1',
      source: 'x',
    });
    const short2 = article({
      id: 's2',
      title: 'Daily News',
      url: 'https://y.example/1',
      source: 'y',
    });
    expect(mergeArticles([], [short1, short2])).toHaveLength(2);
  });
});
