import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, buildNotifyConfig, detectPushSupport } from './push';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

function env(options: { push: boolean; userAgent: string; touch?: number; standalone?: boolean }) {
  const win = {
    matchMedia: (query: string) =>
      ({ matches: options.standalone === true && query.includes('standalone') }) as MediaQueryList,
    ...(options.push ? { PushManager: {}, Notification: {} } : {}),
  };
  const nav = {
    userAgent: options.userAgent,
    maxTouchPoints: options.touch ?? 0,
    ...(options.push ? { serviceWorker: {} } : {}),
  };
  return { window: win, navigator: nav };
}

describe('detectPushSupport', () => {
  it('Push API があれば使える', () => {
    expect(detectPushSupport(env({ push: true, userAgent: IPHONE_UA, standalone: true }))).toBe(
      'supported',
    );
  });

  it('iPhone・iPad の Safari で、ホーム画面から開いていなければ追加を案内する', () => {
    expect(detectPushSupport(env({ push: false, userAgent: IPHONE_UA }))).toBe('needs-install');
    // iPadOS の Safari は Mac と同じ userAgent になる
    expect(detectPushSupport(env({ push: false, userAgent: MAC_UA, touch: 5 }))).toBe(
      'needs-install',
    );
  });

  it('それ以外で Push API がなければ使えない', () => {
    expect(detectPushSupport(env({ push: false, userAgent: MAC_UA }))).toBe('unsupported');
    expect(detectPushSupport(env({ push: false, userAgent: IPHONE_UA, standalone: true }))).toBe(
      'unsupported',
    );
  });
});

describe('base64UrlToBytes', () => {
  it('base64url（パディングなし）をバイト列にする', () => {
    expect([...base64UrlToBytes('-_8')]).toEqual([0xfb, 0xff]);
    expect([...base64UrlToBytes('AQID')]).toEqual([1, 2, 3]);
  });
});

describe('buildNotifyConfig', () => {
  const subscription: PushSubscriptionJSON = {
    endpoint: 'https://web.push.apple.com/abc',
    expirationTime: null,
    keys: { p256dh: 'p256', auth: 'auth' },
  };

  it('購読情報・注目キーワード・静かな時間帯をまとめる', () => {
    expect(buildNotifyConfig(subscription, ['MCP'], { start: 23, end: 7 })).toEqual({
      subscription,
      keywords: ['MCP'],
      quietHours: { start: 23, end: 7 },
    });
  });

  it('購読情報の形が違えば undefined', () => {
    expect(buildNotifyConfig({ endpoint: 'https://x.example' }, [], null)).toBeUndefined();
  });
});
