import type { TechEvent } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import { buildEvents, toEvent } from './build';
import type { EventCandidate } from './build';

const NOW = Date.parse('2026-10-23T12:00:00+09:00');

function candidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    source: 'doorkeeper',
    externalId: '1',
    title: 'LLM 勉強会 #1',
    url: 'https://example.doorkeeper.jp/events/1',
    startAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

function event(overrides: Partial<TechEvent> = {}): TechEvent {
  return {
    id: 'doorkeeper-1',
    title: 'LLM 勉強会 #1',
    url: 'https://example.doorkeeper.jp/events/1',
    source: 'doorkeeper',
    type: 'meetup',
    format: 'online',
    startAt: '2026-11-01T19:00:00+09:00',
    tags: [],
    ...overrides,
  };
}

describe('toEvent', () => {
  it('候補を TechEvent にする（日時は日本時間、文字列はプレーンテキスト）', () => {
    expect(
      toEvent(
        candidate({
          title: 'Claude Code &amp; MCP 勉強会',
          endAt: '2026-11-01T12:00:00.000Z',
          venue: 'ABC株式会社 <b>セミナールーム</b>',
          address: '東京都港区六本木1-1',
          organizer: 'AI 開発者の会',
          capacity: 50,
          accepted: 12,
          description: '<p>MCP サーバーを作ります</p>',
        }),
      ),
    ).toEqual({
      id: 'doorkeeper-1',
      title: 'Claude Code & MCP 勉強会',
      url: 'https://example.doorkeeper.jp/events/1',
      source: 'doorkeeper',
      type: 'meetup',
      format: 'offline',
      startAt: '2026-11-01T19:00:00+09:00',
      endAt: '2026-11-01T21:00:00+09:00',
      venue: 'ABC株式会社 セミナールーム',
      address: '東京都港区六本木1-1',
      organizer: 'AI 開発者の会',
      capacity: 50,
      accepted: 12,
      tags: ['ai-dev', 'ai-agent', 'ai-model'],
    });
  });

  it('オンラインのみのイベントは会場を出さない', () => {
    const result = toEvent(candidate({ venue: 'オンライン' }));
    expect(result?.format).toBe('online');
    expect(result).not.toHaveProperty('venue');
  });

  it('東京・オンラインでないイベントは除く', () => {
    expect(toEvent(candidate({ address: '大阪府大阪市北区梅田' }))).toBeNull();
  });

  it('IT・AI・セキュリティに関係ないイベントは除く', () => {
    expect(toEvent(candidate({ title: '白菜キムチ作りクラス' }))).toBeNull();
  });

  it('関連性が分かっている候補は判定を省く', () => {
    expect(toEvent(candidate({ title: '白菜キムチ作りクラス', relevant: true }))).not.toBeNull();
  });

  it('分かっている形式・種別を使う', () => {
    const result = toEvent(candidate({ format: 'hybrid', type: 'expo' }));
    expect(result).toMatchObject({ format: 'hybrid', type: 'expo' });
  });

  it('日時・URL・タイトルが正しくなければ除く', () => {
    expect(toEvent(candidate({ startAt: '未定' }))).toBeNull();
    expect(toEvent(candidate({ url: 'javascript:alert(1)' }))).toBeNull();
    expect(toEvent(candidate({ title: '<b></b>' }))).toBeNull();
  });

  it('開始より前の終了日時と、0人の定員は出さない', () => {
    const result = toEvent(candidate({ endAt: '2026-11-01T09:00:00.000Z', capacity: 0 }));
    expect(result).not.toHaveProperty('endAt');
    expect(result).not.toHaveProperty('capacity');
  });
});

describe('buildEvents', () => {
  it('終了したイベントを除き、開催日が近い順に並べる', () => {
    const events = buildEvents({
      previous: [],
      incoming: [
        event({ id: 'doorkeeper-2', title: 'B', startAt: '2026-11-05T19:00:00+09:00' }),
        event({ id: 'doorkeeper-3', title: 'C', startAt: '2026-10-20T19:00:00+09:00' }),
        event({ id: 'doorkeeper-4', title: 'D', startAt: '2026-11-01T19:00:00+09:00' }),
        // 終了日時がなければ開始日の終わりまで残す
        event({ id: 'doorkeeper-5', title: 'E', startAt: '2026-10-23T09:00:00+09:00' }),
      ],
      now: NOW,
    });
    expect(events.map((e) => e.id)).toEqual(['doorkeeper-5', 'doorkeeper-4', 'doorkeeper-2']);
  });

  it('前回のイベントを残し、今回取得したイベントで置き換える', () => {
    const events = buildEvents({
      previous: [event({ id: 'techplay-1', title: '前回だけ' }), event({ title: '古い題名' })],
      incoming: [event({ title: '新しい題名' })],
      now: NOW,
    });
    expect(events.map((e) => e.title).sort()).toEqual(['前回だけ', '新しい題名']);
  });

  it('removedIds と dropPrevious に当てはまるイベントを除く', () => {
    const events = buildEvents({
      previous: [
        event({ id: 'connpass-1', title: '中止' }),
        event({ id: 'manual-1', source: 'manual', title: '手動' }),
        event({ id: 'doorkeeper-9', title: '残る' }),
      ],
      incoming: [],
      removedIds: new Set(['connpass-1']),
      dropPrevious: (e) => e.id.startsWith('manual-'),
      now: NOW,
    });
    expect(events.map((e) => e.id)).toEqual(['doorkeeper-9']);
  });

  it('タイトルと開始日時が同じイベントは、優先する情報源の1件にまとめる', () => {
    const events = buildEvents({
      previous: [],
      incoming: [
        event({ id: 'techplay-1', source: 'techplay', title: 'AI 勉強会 #3' }),
        event({ id: 'connpass-1', source: 'connpass', title: 'AI勉強会 #3' }),
        event({ id: 'doorkeeper-1', title: 'AI 勉強会 #3', startAt: '2026-11-02T19:00:00+09:00' }),
      ],
      now: NOW,
    });
    expect(events.map((e) => e.id)).toEqual(['connpass-1', 'doorkeeper-1']);
  });
});
