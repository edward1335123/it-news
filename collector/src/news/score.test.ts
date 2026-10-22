import type { Article } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import { hnBonus, scoreArticle } from './score';
import type { ScoreContext } from './score';

const NOW = Date.parse('2026-10-23T00:00:00Z');
const HOUR = 60 * 60 * 1000;

function article(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a',
    title: 't',
    url: 'https://example.com/a',
    source: 'media',
    lang: 'en',
    publishedAt: new Date(NOW - 48 * HOUR).toISOString(),
    category: 'ai',
    tags: ['ai-model'],
    score: 0,
    related: [],
    ...overrides,
  };
}

const context: ScoreContext = {
  now: NOW,
  isPrimary: (id) => id === 'official',
  hnPoints: () => undefined,
};

describe('scoreArticle', () => {
  it('古く、単独の報道で、一次情報でもなければ基本点だけ', () => {
    expect(scoreArticle(article(), context)).toBe(10);
  });

  it('報道した情報源の数で加算し、同じ情報源は1回だけ数える', () => {
    const related = [
      { source: 'b', url: 'https://b.example/' },
      { source: 'c', url: 'https://c.example/' },
      { source: 'c', url: 'https://c.example/2' },
    ];
    expect(scoreArticle(article({ related }), context)).toBe(10 + 40);
  });

  it('一次情報を含めば加算する', () => {
    expect(scoreArticle(article({ source: 'official' }), context)).toBe(30);
    const related = [{ source: 'official', url: 'https://o.example/' }];
    expect(scoreArticle(article({ related }), context)).toBe(10 + 20 + 20);
  });

  it('新しいほど加算する', () => {
    const fresh = article({ publishedAt: new Date(NOW).toISOString() });
    const day = article({ publishedAt: new Date(NOW - 24 * HOUR).toISOString() });
    expect(scoreArticle(fresh, context)).toBe(40);
    expect(scoreArticle(day, context)).toBe(25);
  });

  it('Hacker News のポイントで加算する', () => {
    expect(scoreArticle(article(), { ...context, hnPoints: () => 100 })).toBe(10 + hnBonus(100));
    expect(hnBonus(0)).toBe(0);
    expect(hnBonus(100)).toBe(35);
    expect(hnBonus(100_000)).toBe(40);
  });

  it('注目の記事（一次情報を複数の媒体が報じた直後）は 80 以上になる', () => {
    const hot = article({
      source: 'official',
      publishedAt: new Date(NOW).toISOString(),
      related: [{ source: 'b', url: 'https://b.example/' }],
    });
    expect(scoreArticle(hot, context)).toBeGreaterThanOrEqual(80);
  });
});
