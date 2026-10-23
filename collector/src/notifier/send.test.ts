import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import { isSubscriptionGone, readNotifierEnv, sendErrorMessage } from './send';

const config = {
  subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p', auth: 'a' } },
  keywords: ['MCP'],
  quietHours: { start: 23, end: 7 },
};

const env = (overrides: Record<string, string | undefined> = {}) => ({
  VAPID_PUBLIC_KEY: 'public',
  VAPID_PRIVATE_KEY: 'private',
  VAPID_SUBJECT: 'mailto:me@example.com',
  PUSH_CONFIG: JSON.stringify(config),
  ...overrides,
});

describe('readNotifierEnv', () => {
  it('鍵と設定を読む', () => {
    expect(readNotifierEnv(env())).toEqual({
      kind: 'ok',
      vapid: { subject: 'mailto:me@example.com', publicKey: 'public', privateKey: 'private' },
      config,
    });
  });

  it('未設定・空のものがあれば通知しない', () => {
    expect(readNotifierEnv(env({ PUSH_CONFIG: undefined, VAPID_PRIVATE_KEY: ' ' }))).toEqual({
      kind: 'skip',
      missing: ['VAPID_PRIVATE_KEY', 'PUSH_CONFIG'],
    });
  });

  it('PUSH_CONFIG が壊れていたらエラーにし、値はエラーの文言に含めない', () => {
    const broken = readNotifierEnv(env({ PUSH_CONFIG: '{"secret-value"' }));
    expect(broken).toEqual({ kind: 'invalid', message: 'PUSH_CONFIG が JSON として正しくない' });

    const wrong = readNotifierEnv(
      env({
        PUSH_CONFIG: JSON.stringify({ ...config, subscription: { endpoint: 'http://x.example' } }),
      }),
    );
    expect(wrong.kind).toBe('invalid');
    if (wrong.kind === 'invalid') expect(wrong.message).not.toContain('x.example');
  });

  it('VAPID_SUBJECT は mailto: か https:// で始める', () => {
    expect(readNotifierEnv(env({ VAPID_SUBJECT: 'me@example.com' })).kind).toBe('invalid');
    expect(readNotifierEnv(env({ VAPID_SUBJECT: 'https://example.com' })).kind).toBe('ok');
  });
});

describe('送信の失敗', () => {
  it('404・410 は購読の解除とみなす', () => {
    const error = (status: number) => new webpush.WebPushError('x', status, {}, 'body', 'e');
    expect(isSubscriptionGone(error(410))).toBe(true);
    expect(isSubscriptionGone(error(404))).toBe(true);
    expect(isSubscriptionGone(error(500))).toBe(false);
    expect(isSubscriptionGone(new Error('x'))).toBe(false);
    expect(sendErrorMessage(error(403))).toBe('プッシュサービスが 403 を返した: body');
  });
});
