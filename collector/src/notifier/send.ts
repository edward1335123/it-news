import { notifyConfigSchema } from '@itnews/shared';
import type { NotifyConfig, PushSubscriptionJson } from '@itnews/shared';
import webpush from 'web-push';
import type { PushPayload } from './plan';

/** 届かなかった通知をプッシュサービスが保持する時間（秒）。半日を過ぎた通知は捨てる */
const TTL_SECONDS = 12 * 60 * 60;
const TIMEOUT_MS = 30_000;

export type Vapid = { subject: string; publicKey: string; privateKey: string };

export type Sender = (subscription: PushSubscriptionJson, payload: PushPayload) => Promise<void>;

export function createSender(vapid: Vapid): Sender {
  return async (subscription, payload) => {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      vapidDetails: vapid,
      TTL: TTL_SECONDS,
      timeout: TIMEOUT_MS,
      urgency: 'high',
      contentEncoding: 'aes128gcm',
    });
  };
}

/** 購読が解除・期限切れになった（プッシュサービスが 404・410 を返した） */
export function isSubscriptionGone(error: unknown): boolean {
  return (
    error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)
  );
}

/** 送信の失敗をログ用の文字列にする。応答の本文には秘密情報が含まれないので出してよい */
export function sendErrorMessage(error: unknown): string {
  if (error instanceof webpush.WebPushError) {
    return `プッシュサービスが ${error.statusCode} を返した: ${error.body.trim().slice(0, 200)}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export type NotifierEnv =
  | { kind: 'skip'; missing: string[] }
  | { kind: 'invalid'; message: string }
  | { kind: 'ok'; vapid: Vapid; config: NotifyConfig };

const REQUIRED_ENV = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'PUSH_CONFIG'];

/**
 * 環境変数から VAPID 鍵と通知の設定を読む。未設定のものがあれば通知しない（skip）。
 * PUSH_CONFIG の値は秘密情報なので、エラーの文言に含めない。
 */
export function readNotifierEnv(env: NodeJS.ProcessEnv): NotifierEnv {
  const value = (name: string) => env[name]?.trim() ?? '';
  const missing = REQUIRED_ENV.filter((name) => value(name) === '');
  if (missing.length > 0) return { kind: 'skip', missing };

  const subject = value('VAPID_SUBJECT');
  if (!/^(mailto:|https:\/\/)/.test(subject)) {
    return { kind: 'invalid', message: 'VAPID_SUBJECT は mailto: か https:// で始める' };
  }

  let json: unknown;
  try {
    json = JSON.parse(value('PUSH_CONFIG'));
  } catch {
    return { kind: 'invalid', message: 'PUSH_CONFIG が JSON として正しくない' };
  }
  const parsed = notifyConfigSchema.safeParse(json);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path.join('.') || '(全体)').join(', ');
    return { kind: 'invalid', message: `PUSH_CONFIG の形式が正しくない（${paths}）` };
  }
  return {
    kind: 'ok',
    vapid: {
      subject,
      publicKey: value('VAPID_PUBLIC_KEY'),
      privateKey: value('VAPID_PRIVATE_KEY'),
    },
    config: parsed.data,
  };
}
