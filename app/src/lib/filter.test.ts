import type { Article, TagId, TechEvent } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import { articlesForTab, sortEvents } from './filter';

function article(id: string, tags: TagId[], publishedAt: string): Article {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    source: 'example',
    lang: 'ja',
    publishedAt,
    category: 'general',
    tags,
    score: 0,
    related: [],
  };
}

const articles = [
  article('dev-old', ['ai-dev'], '2026-10-20T00:00:00Z'),
  article('vuln', ['sec-vuln'], '2026-10-21T00:00:00Z'),
  article('ai-sec', ['ai-security'], '2026-10-22T00:00:00Z'),
  article('dev-new', ['ai-dev', 'ai-agent'], '2026-10-22T01:00:00Z'),
  article('none', [], '2026-10-22T02:00:00Z'),
];

const ids = (list: Article[]) => list.map((a) => a.id);

describe('articlesForTab', () => {
  it('タブのサブカテゴリを持つ記事を新しい順に返す', () => {
    expect(ids(articlesForTab(articles, 'ai', null))).toEqual(['dev-new', 'ai-sec', 'dev-old']);
    expect(ids(articlesForTab(articles, 'security', null))).toEqual(['ai-sec', 'vuln']);
  });

  it('サブカテゴリで絞り込む', () => {
    expect(ids(articlesForTab(articles, 'ai', 'ai-dev'))).toEqual(['dev-new', 'dev-old']);
    expect(ids(articlesForTab(articles, 'ai', 'ai-agent'))).toEqual(['dev-new']);
    expect(ids(articlesForTab(articles, 'security', 'ai-security'))).toEqual(['ai-sec']);
    expect(articlesForTab(articles, 'ai', 'ai-oss')).toEqual([]);
  });

  it('元の配列を並べ替えない', () => {
    const before = ids(articles);
    articlesForTab(articles, 'ai', null);
    expect(ids(articles)).toEqual(before);
  });
});

describe('sortEvents', () => {
  it('開催日が近い順に並べる（タイムゾーンが違っても時刻で比べる）', () => {
    const event = (id: string, startAt: string): TechEvent => ({
      id,
      title: id,
      url: `https://example.com/${id}`,
      source: 'manual',
      type: 'meetup',
      format: 'online',
      startAt,
      tags: [],
    });
    const events = [
      event('c', '2026-11-01T10:00:00+09:00'),
      event('a', '2026-10-31T23:00:00Z'), // 東京では 11/1 08:00
      event('b', '2026-11-01T09:00:00+09:00'),
    ];
    expect(sortEvents(events).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(events.map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });
});
