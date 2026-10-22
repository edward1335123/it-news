import type { TechEvent } from '@itnews/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../io';
import { collectEvents } from './collect';

const NOW = Date.parse('2026-10-23T12:00:00+09:00');

function createLog() {
  return {
    info: vi.fn<Logger['info']>(),
    warn: vi.fn<Logger['warn']>(),
    error: vi.fn<Logger['error']>(),
  } satisfies Logger;
}

const manualEvent: TechEvent = {
  id: 'manual-expo',
  title: 'AI EXPO 東京',
  url: 'https://example.com/expo',
  source: 'manual',
  type: 'expo',
  format: 'offline',
  startAt: '2026-12-01T10:00:00+09:00',
  venue: '東京ビッグサイト',
  tags: [],
};

describe('collectEvents', () => {
  it('スキップした情報源はエラーにせず、ログに理由を残す', async () => {
    const log = createLog();
    const result = await collectEvents({
      tasks: [{ id: 'connpass', skip: '環境変数 CONNPASS_API_KEY が未設定' }],
      manual: [manualEvent],
      previous: [],
      now: NOW,
      log,
    });
    expect(result).toEqual({ events: [manualEvent], failures: [], attempted: 0 });
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('CONNPASS_API_KEY'));
    expect(log.error).not.toHaveBeenCalled();
  });

  it('失敗した情報源はログに残して飛ばし、前回のイベントを残す', async () => {
    const log = createLog();
    const previous: TechEvent = {
      ...manualEvent,
      id: 'doorkeeper-1',
      source: 'doorkeeper',
      title: '前回の AI 勉強会',
      type: 'meetup',
    };
    const result = await collectEvents({
      tasks: [
        { id: 'doorkeeper', run: () => Promise.reject(new Error('HTTP 503')) },
        {
          id: 'techplay',
          run: () =>
            Promise.resolve({
              candidates: [
                {
                  source: 'techplay',
                  externalId: '5',
                  title: 'LLM 勉強会',
                  url: 'https://techplay.jp/event/5',
                  startAt: '2026-11-01 19:00:00',
                  venue: 'オンライン',
                },
                {
                  source: 'techplay',
                  externalId: '6',
                  title: '白菜キムチ作りクラス',
                  url: 'https://techplay.jp/event/6',
                  startAt: '2026-11-01 19:00:00',
                },
              ],
            }),
        },
      ],
      manual: [],
      previous: [previous],
      now: NOW,
      log,
    });

    expect(result.failures).toEqual([{ sourceId: 'doorkeeper', error: 'HTTP 503' }]);
    expect(result.attempted).toBe(2);
    expect(result.events.map((e) => e.id)).toEqual(['techplay-5', 'doorkeeper-1']);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('doorkeeper'));
    expect(log.info).toHaveBeenCalledWith('[events] techplay: 2件中 1件を取り込む');
  });

  it('手動管理のファイルから消したイベントは前回から引き継がない', async () => {
    const result = await collectEvents({
      tasks: [],
      manual: [],
      previous: [manualEvent, { ...manualEvent, id: 'manual-official-x-20261201', title: '公式' }],
      now: NOW,
      log: createLog(),
    });
    expect(result.events.map((e) => e.id)).toEqual(['manual-official-x-20261201']);
  });
});
