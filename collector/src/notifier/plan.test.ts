import type { Article } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE,
  FRESHNESS_MS,
  SENT_RETENTION_MS,
  findCandidates,
  isQuietTime,
  jstHour,
  planNotifications,
  pruneState,
  recordDelivery,
} from './plan';
import type { NotifyState } from './plan';

const HOUR = 60 * 60 * 1000;
/** 日本時間 2026-10-23 12:00 */
const NOW = Date.parse('2026-10-23T12:00:00+09:00');
/** 日本時間 2026-10-23 の hour 時 */
const at = (hour: number) => Date.parse(`2026-10-23T${String(hour).padStart(2, '0')}:00:00+09:00`);

const kev = (id: string, hoursAgo = 1): Article => ({
  id,
  title: `CVE-2026-${id}: Vulnerability`,
  url: `https://example.com/${id}`,
  source: 'cisa-kev',
  lang: 'en',
  publishedAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
  category: 'security',
  tags: ['sec-vuln'],
  score: 1,
  related: [],
});

const plain = (id: string, title: string, hoursAgo = 1): Article => ({
  ...kev(id, hoursAgo),
  source: 'publickey',
  title,
});

const plan = (
  articles: Article[],
  overrides: Partial<Parameters<typeof planNotifications>[0]> = {},
) =>
  planNotifications({
    articles,
    state: EMPTY_STATE,
    keywords: [],
    quietHours: null,
    now: NOW,
    ...overrides,
  });

const articleIdsOf = (result: ReturnType<typeof planNotifications>) =>
  result.kind === 'send' ? result.messages.map((m) => m.articleIds) : result.kind;

describe('静かな時間帯', () => {
  it('日本時間の時を返す', () => {
    expect(jstHour(at(23) + 30 * 60 * 1000)).toBe(23);
    expect(jstHour(Date.parse('2026-10-23T00:10:00Z'))).toBe(9);
  });

  it('日をまたぐ時間帯（23時〜7時）', () => {
    const quiet = { start: 23, end: 7 };
    expect(isQuietTime(quiet, at(23))).toBe(true);
    expect(isQuietTime(quiet, at(3))).toBe(true);
    expect(isQuietTime(quiet, at(7) - 1)).toBe(true);
    expect(isQuietTime(quiet, at(7))).toBe(false);
    expect(isQuietTime(quiet, at(22))).toBe(false);
  });

  it('日をまたがない時間帯（1時〜5時）と、時間帯なし', () => {
    expect(isQuietTime({ start: 1, end: 5 }, at(1))).toBe(true);
    expect(isQuietTime({ start: 1, end: 5 }, at(5))).toBe(false);
    expect(isQuietTime({ start: 1, end: 5 }, at(0))).toBe(false);
    expect(isQuietTime(null, at(3))).toBe(false);
  });
});

describe('findCandidates', () => {
  it('送信済み・古い・条件に当てはまらない記事は除く', () => {
    const state: NotifyState = { sent: { sent: NOW - HOUR }, deliveries: [] };
    const articles = [
      kev('sent'),
      kev('old', FRESHNESS_MS / HOUR + 1),
      plain('plain', 'ふつうの記事'),
      kev('new'),
    ];
    expect(findCandidates(articles, state, [], NOW).map((c) => c.article.id)).toEqual(['new']);
  });

  it('優先度の高い順、同じ優先度なら新しい順に並べる', () => {
    const articles = [
      plain('kw', 'MCP の新機能', 1),
      kev('kev-old', 5),
      plain('cvss', 'Flaw (CVSS 9.8)', 1),
      kev('kev-new', 2),
    ];
    expect(findCandidates(articles, EMPTY_STATE, ['mcp'], NOW).map((c) => c.article.id)).toEqual([
      'kev-new',
      'kev-old',
      'cvss',
      'kw',
    ]);
  });

  it('constructor などのプロトタイプのキーを送信済みと取り違えない', () => {
    expect(findCandidates([kev('constructor')], EMPTY_STATE, [], NOW)).toHaveLength(1);
  });
});

describe('planNotifications', () => {
  it('当てはまる新着がなければ送らない', () => {
    expect(plan([plain('a', 'ふつうの記事')])).toEqual({ kind: 'none' });
  });

  it('記事ごとに、理由をタイトル・記事名を本文にして送る', () => {
    expect(plan([kev('a')])).toEqual({
      kind: 'send',
      messages: [
        {
          payload: {
            title: 'CISA KEV に追加',
            body: 'CVE-2026-a: Vulnerability',
            url: 'https://example.com/a',
            tag: 'a',
          },
          articleIds: ['a'],
        },
      ],
    });
  });

  it('静かな時間帯は送らない', () => {
    expect(plan([kev('a'), kev('b')], { quietHours: { start: 11, end: 13 } })).toEqual({
      kind: 'quiet',
      pending: 2,
    });
  });

  it('上限を超える分は、最後の1件にまとめる', () => {
    const articles = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => kev(id, i + 1));
    const result = plan(articles, { maxPerHour: 3 });
    expect(articleIdsOf(result)).toEqual([['a'], ['b'], ['c', 'd', 'e', 'f', 'g']]);
    if (result.kind !== 'send') return;
    expect(result.messages[2]?.payload).toMatchObject({ title: 'ほかに5件の新着', tag: 'summary' });
    expect(result.messages[2]?.payload.url).toBeUndefined();
  });

  it('ちょうど上限の数なら、まとめずに送る', () => {
    expect(articleIdsOf(plan([kev('a'), kev('b')], { maxPerHour: 2 }))).toEqual([['a'], ['b']]);
  });

  it('直近1時間に送った数を上限から引き、使い切っていたら送らない', () => {
    const state: NotifyState = { sent: {}, deliveries: [NOW - 10 * 60 * 1000, NOW - 2 * HOUR] };
    expect(articleIdsOf(plan([kev('a'), kev('b')], { state, maxPerHour: 2 }))).toEqual([
      ['a', 'b'],
    ]);

    const full: NotifyState = { sent: {}, deliveries: [NOW - 1000, NOW - 2000] };
    expect(plan([kev('a')], { state: full, maxPerHour: 2 })).toEqual({
      kind: 'limited',
      pending: 1,
    });
  });
});

describe('送信済みの記録', () => {
  it('送った記事と時刻を記録する', () => {
    expect(recordDelivery(EMPTY_STATE, ['a', 'b'], NOW)).toEqual({
      sent: { a: NOW, b: NOW },
      deliveries: [NOW],
    });
  });

  it('古い記録を捨てる', () => {
    const state: NotifyState = {
      sent: { old: NOW - SENT_RETENTION_MS, recent: NOW - HOUR },
      deliveries: [NOW - HOUR, NOW - 1000],
    };
    expect(pruneState(state, NOW)).toEqual({
      sent: { recent: NOW - HOUR },
      deliveries: [NOW - 1000],
    });
  });
});
