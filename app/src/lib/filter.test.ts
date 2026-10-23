import type { Article, TagId, TechEvent } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import {
  applyArticleFilter,
  articlesForTab,
  eventEndTime,
  filterEvents,
  groupArticlesByDay,
  normalizeText,
  searchArticles,
  sortEvents,
} from './filter';

function article(
  id: string,
  tags: TagId[],
  publishedAt: string,
  extra: Partial<Article> = {},
): Article {
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
    ...extra,
  };
}

function event(id: string, startAt: string, extra: Partial<TechEvent> = {}): TechEvent {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    source: 'manual',
    type: 'meetup',
    format: 'online',
    startAt,
    tags: [],
    ...extra,
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
    const events = [
      event('c', '2026-11-01T10:00:00+09:00'),
      event('a', '2026-10-31T23:00:00Z'), // 東京では 11/1 08:00
      event('b', '2026-11-01T09:00:00+09:00'),
    ];
    expect(sortEvents(events).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(events.map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('normalizeText', () => {
  it('全角・半角と大文字・小文字の違いをなくす', () => {
    expect(normalizeText('ＣＶＥ－２０２６ Ｃｌａｕｄｅ')).toBe('cve-2026 claude');
    expect(normalizeText('ｶﾀｶﾅ')).toBe('カタカナ');
  });
});

describe('searchArticles', () => {
  const list = [
    article('old', [], '2026-10-20T00:00:00Z', { title: 'Claude Code の新機能' }),
    article('new', [], '2026-10-22T00:00:00Z', {
      title: 'MCP サーバーの脆弱性',
      summary: 'Claude Desktop に影響',
    }),
    article('other', [], '2026-10-21T00:00:00Z', { title: 'Gemini の料金改定' }),
  ];

  it('タイトルと抜粋から探し、新しい順に返す', () => {
    expect(ids(searchArticles(list, 'claude'))).toEqual(['new', 'old']);
  });

  it('空白で区切った語をすべて含む記事だけを返す（全角の空白も区切りにする）', () => {
    expect(ids(searchArticles(list, 'claude　脆弱性'))).toEqual(['new']);
    expect(ids(searchArticles(list, 'claude gemini'))).toEqual([]);
  });

  it('全角や大文字で入力しても一致する', () => {
    expect(ids(searchArticles(list, 'ＭＣＰ'))).toEqual(['new']);
  });

  it('語がなければ何も返さない', () => {
    expect(searchArticles(list, '   ')).toEqual([]);
  });
});

describe('applyArticleFilter', () => {
  const list = [
    article('a', [], '2026-10-22T00:00:00Z', { source: 'zenn', title: '【PR】おすすめツール' }),
    article('b', [], '2026-10-22T00:00:00Z', { source: 'zenn', summary: 'エンジニア求人特集' }),
    article('c', [], '2026-10-22T00:00:00Z', { source: 'publickey' }),
    article('d', [], '2026-10-22T00:00:00Z', { source: 'qiita' }),
  ];
  const none = {
    langMode: 'all',
    mutedWords: [],
    disabledSources: [],
    unreadOnly: false,
    isRead: () => false,
  } as const;

  it('条件がなければすべて返す', () => {
    expect(ids(applyArticleFilter(list, none))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ミュート語をタイトルか抜粋に含む記事を隠す（表記ゆれも一致させ、空の語は無視する）', () => {
    expect(ids(applyArticleFilter(list, { ...none, mutedWords: ['ｐｒ', '求人', ' '] }))).toEqual([
      'c',
      'd',
    ]);
  });

  it('OFF にした情報源の記事を隠す', () => {
    expect(ids(applyArticleFilter(list, { ...none, disabledSources: ['zenn', 'qiita'] }))).toEqual([
      'c',
    ]);
  });

  it('未読のみ表示なら既読を隠し、OFF なら既読も表示する', () => {
    const isRead = (id: string) => id === 'a' || id === 'c';
    expect(ids(applyArticleFilter(list, { ...none, unreadOnly: true, isRead }))).toEqual([
      'b',
      'd',
    ]);
    expect(ids(applyArticleFilter(list, { ...none, isRead }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('「日本語のみ」なら英語の記事を隠し、「日本語＋英語」なら両方を表示する', () => {
    const mixed = [...list, article('e', [], '2026-10-22T00:00:00Z', { lang: 'en' })];
    expect(ids(applyArticleFilter(mixed, { ...none, langMode: 'ja' }))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(ids(applyArticleFilter(mixed, none))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('groupArticlesByDay', () => {
  const now = new Date('2026-10-23T10:00:00+09:00');

  it('公開日（東京時間）ごとに分け、見出しと記事の順番を保つ', () => {
    const list = [
      article('a', [], '2026-10-23T09:00:00+09:00'),
      article('b', [], '2026-10-23T00:00:00+09:00'),
      // UTC では 10/22 だが東京では 10/23 の 0:30
      article('c', [], '2026-10-22T15:30:00Z'),
      article('d', [], '2026-10-22T23:59:59+09:00'),
      article('e', [], '2026-10-21T08:00:00+09:00'),
      article('f', [], '2025-12-31T20:00:00+09:00'),
    ];
    const groups = groupArticlesByDay(list, now);
    expect(groups.map((g) => [g.key, g.label, g.today, ids(g.articles)])).toEqual([
      ['2026-10-23', '今日', true, ['a', 'b', 'c']],
      ['2026-10-22', '昨日', false, ['d']],
      ['2026-10-21', '10月21日（水）', false, ['e']],
      ['2025-12-31', '2025年12月31日（水）', false, ['f']],
    ]);
  });

  it('同じ日の記事が離れていても1つの区切りにまとめる', () => {
    const list = [
      article('a', [], '2026-10-23T09:00:00+09:00'),
      article('b', [], '2026-10-22T09:00:00+09:00'),
      article('c', [], '2026-10-23T08:00:00+09:00'),
    ];
    expect(groupArticlesByDay(list, now).map((g) => ids(g.articles))).toEqual([['a', 'c'], ['b']]);
  });

  it('記事がなければ区切りもない', () => {
    expect(groupArticlesByDay([], now)).toEqual([]);
  });

  it('now より後の日付の記事は今日にまとめる（0:00 をまたいで再取得したとき）', () => {
    const beforeMidnight = new Date('2026-10-23T23:50:00+09:00');
    const list = [
      article('a', [], '2026-10-24T00:05:00+09:00'),
      article('b', [], '2026-10-23T23:00:00+09:00'),
      article('c', [], '2026-10-22T23:00:00+09:00'),
    ];
    expect(
      groupArticlesByDay(list, beforeMidnight).map((g) => [
        g.key,
        g.label,
        g.today,
        ids(g.articles),
      ]),
    ).toEqual([
      ['2026-10-23', '今日', true, ['a', 'b']],
      ['2026-10-22', '昨日', false, ['c']],
    ]);
  });
});

describe('eventEndTime', () => {
  it('終了日時があればその時刻', () => {
    const e = event('e', '2026-10-24T19:00:00+09:00', { endAt: '2026-10-24T21:00:00+09:00' });
    expect(eventEndTime(e)).toBe(Date.parse('2026-10-24T21:00:00+09:00'));
  });

  it('終了日時がなければ開始日の終わり（東京の 24:00）', () => {
    expect(eventEndTime(event('e', '2026-10-24T19:00:00+09:00'))).toBe(
      Date.parse('2026-10-25T00:00:00+09:00'),
    );
    // UTC では前日でも、東京の日付で判定する
    expect(eventEndTime(event('e', '2026-10-24T23:30:00Z'))).toBe(
      Date.parse('2026-10-26T00:00:00+09:00'),
    );
    expect(eventEndTime(event('e', '2026-10-24T00:00:00+09:00'))).toBe(
      Date.parse('2026-10-25T00:00:00+09:00'),
    );
  });
});

describe('filterEvents', () => {
  const events = [
    event('expo-offline', '2026-10-28T10:00:00+09:00', { type: 'expo', format: 'offline' }),
    event('meetup-online', '2026-10-24T19:00:00+09:00', { type: 'meetup', format: 'online' }),
    event('meetup-hybrid', '2026-10-26T19:00:00+09:00', { type: 'meetup', format: 'hybrid' }),
    event('ended', '2026-10-20T19:00:00+09:00', {
      endAt: '2026-10-20T21:00:00+09:00',
      type: 'meetup',
      format: 'online',
    }),
    event('ongoing', '2026-10-21T10:00:00+09:00', {
      endAt: '2026-10-23T17:00:00+09:00',
      type: 'expo',
      format: 'offline',
    }),
  ];
  const now = new Date('2026-10-22T12:00:00+09:00');
  const all = { type: null, format: null };

  it('終了したイベントを除き、開催中のものは残して近い順に並べる', () => {
    expect(filterEvents(events, all, now).map((e) => e.id)).toEqual([
      'ongoing',
      'meetup-online',
      'meetup-hybrid',
      'expo-offline',
    ]);
  });

  it('終了時刻ちょうどで表示しなくなる', () => {
    const atEnd = new Date('2026-10-23T17:00:00+09:00');
    expect(filterEvents(events, all, atEnd).map((e) => e.id)).not.toContain('ongoing');
  });

  it('種別・形式で絞り込み、両方を指定すると AND になる', () => {
    const ids = (filter: Parameters<typeof filterEvents>[1]) =>
      filterEvents(events, filter, now).map((e) => e.id);
    expect(ids({ type: 'meetup', format: null })).toEqual(['meetup-online', 'meetup-hybrid']);
    expect(ids({ type: null, format: 'offline' })).toEqual(['ongoing', 'expo-offline']);
    expect(ids({ type: 'meetup', format: 'hybrid' })).toEqual(['meetup-hybrid']);
    expect(ids({ type: 'conference', format: null })).toEqual([]);
  });
});
