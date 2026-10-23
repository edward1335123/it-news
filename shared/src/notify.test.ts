import { describe, expect, it } from 'vitest';
import {
  NOTIFY_KEYWORD_MAX_COUNT,
  NOTIFY_KEYWORD_MAX_LENGTH,
  normalizeText,
  notifyConfigSchema,
} from './notify';
import type { NotifyConfig } from './notify';

const config: NotifyConfig = {
  subscription: {
    endpoint: 'https://web.push.apple.com/abc',
    expirationTime: null,
    keys: { p256dh: 'p256', auth: 'auth' },
  },
  keywords: ['Claude Code'],
  quietHours: { start: 23, end: 7 },
};

describe('notifyConfigSchema', () => {
  it('アプリが作る設定を受け付ける', () => {
    expect(notifyConfigSchema.parse(config)).toEqual(config);
    expect(notifyConfigSchema.parse({ ...config, quietHours: null }).quietHours).toBeNull();
  });

  it('endpoint は https のみ、鍵は空にできない', () => {
    const withSub = (subscription: object) => ({ ...config, subscription });
    const keys = config.subscription.keys;
    for (const subscription of [
      { endpoint: 'http://push.example.com/a', keys },
      { endpoint: 'javascript:alert(1)', keys },
      { endpoint: 'https://push.example.com/a', keys: { ...keys, auth: '' } },
    ]) {
      expect(notifyConfigSchema.safeParse(withSub(subscription)).success).toBe(false);
    }
  });

  it('静かな時間帯は 0〜23 時の整数で、開始と終了は別の時刻', () => {
    for (const quietHours of [
      { start: 24, end: 7 },
      { start: 1.5, end: 7 },
      { start: 7, end: 7 },
    ]) {
      expect(notifyConfigSchema.safeParse({ ...config, quietHours }).success).toBe(false);
    }
  });

  it('キーワードは空・長すぎるもの・多すぎる数を受け付けない', () => {
    const withKeywords = (keywords: string[]) =>
      notifyConfigSchema.safeParse({ ...config, keywords }).success;
    expect(withKeywords([' '])).toBe(false);
    expect(withKeywords(['あ'.repeat(NOTIFY_KEYWORD_MAX_LENGTH + 1)])).toBe(false);
    expect(withKeywords(Array.from({ length: NOTIFY_KEYWORD_MAX_COUNT + 1 }, String))).toBe(false);
  });
});

describe('normalizeText', () => {
  it('全角・半角や大文字・小文字の違いをなくす', () => {
    expect(normalizeText('ＣＶＥ－２０２６ Ｃｌａｕｄｅ')).toBe('cve-2026 claude');
  });
});
