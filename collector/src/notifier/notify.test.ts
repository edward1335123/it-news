import type { Article, NotifyConfig } from '@itnews/shared';
import webpush from 'web-push';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../io';
import { runNotifier } from './notify';
import { EMPTY_STATE } from './plan';
import type { PushPayload } from './plan';
import type { Sender } from './send';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00+09:00');

const kev = (id: string): Article => ({
  id,
  title: `CVE-2026-${id}`,
  url: `https://example.com/${id}`,
  source: 'cisa-kev',
  lang: 'en',
  publishedAt: new Date(NOW - HOUR).toISOString(),
  category: 'security',
  tags: ['sec-vuln'],
  score: 1,
  related: [],
});

const config: NotifyConfig = {
  subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p', auth: 'a' } },
  keywords: [],
  quietHours: null,
};

function createLog() {
  const lines: string[] = [];
  const log: Logger = {
    info: (m) => lines.push(m),
    warn: (m) => lines.push(m),
    error: (m) => lines.push(m),
  };
  return { log, lines };
}

describe('runNotifier', () => {
  it('通知を送り、送った記事を送信済みにする。次の実行では同じ記事を送らない', async () => {
    const sent: PushPayload[] = [];
    const send: Sender = (_, payload) => {
      sent.push(payload);
      return Promise.resolve();
    };
    const { log } = createLog();
    const first = await runNotifier({
      articles: [kev('a')],
      state: EMPTY_STATE,
      config,
      send,
      now: NOW,
      log,
    });
    expect(first).toMatchObject({ sent: 1, failed: false });
    expect(sent.map((p) => p.tag)).toEqual(['a']);

    const second = await runNotifier({
      articles: [kev('a')],
      state: first.state,
      config,
      send,
      now: NOW + 3 * HOUR,
      log,
    });
    expect(second.sent).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('静かな時間帯は送らず、明けた後の実行で送る', async () => {
    const send = vi.fn<Sender>(() => Promise.resolve());
    const { log } = createLog();
    const quiet = { ...config, quietHours: { start: 11, end: 13 } };
    const during = await runNotifier({
      articles: [kev('a')],
      state: EMPTY_STATE,
      config: quiet,
      send,
      now: NOW,
      log,
    });
    expect(send).not.toHaveBeenCalled();

    const after = await runNotifier({
      articles: [kev('a')],
      state: during.state,
      config: quiet,
      send,
      now: NOW + 2 * HOUR,
      log,
    });
    expect(after.sent).toBe(1);
  });

  it('送信に失敗したら残りは送らず、送れた分だけを記録する', async () => {
    const send = vi
      .fn<Sender>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network'));
    const { log, lines } = createLog();
    const result = await runNotifier({
      articles: [kev('a'), kev('b'), kev('c')],
      state: EMPTY_STATE,
      config,
      send,
      now: NOW,
      log,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(true);
    expect(Object.keys(result.state.sent)).toHaveLength(1);
    expect(lines.some((l) => l.includes('network'))).toBe(true);
  });

  it('購読が解除されていたら、登録し直すよう案内する', async () => {
    const gone = new webpush.WebPushError('gone', 410, {}, '', 'https://push.example.com/abc');
    const send = vi.fn<Sender>().mockRejectedValue(gone);
    const { log, lines } = createLog();
    const result = await runNotifier({
      articles: [kev('a')],
      state: EMPTY_STATE,
      config,
      send,
      now: NOW,
      log,
    });
    expect(result.failed).toBe(true);
    expect(lines.some((l) => l.includes('PUSH_CONFIG を登録し直す'))).toBe(true);
  });
});
