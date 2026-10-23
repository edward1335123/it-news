import { z } from 'zod';

/**
 * プッシュ通知の設定（SPEC 8章）。
 * アプリの設定画面で作り、利用者が GitHub Actions の Secret `PUSH_CONFIG` に登録する。
 * notifier はこれを読んで、通知先・注目キーワード・静かな時間帯を決める。
 */

/** 注目キーワードの最大文字数 */
export const NOTIFY_KEYWORD_MAX_LENGTH = 50;
/** 注目キーワードの最大数（Secret の大きさを抑える） */
export const NOTIFY_KEYWORD_MAX_COUNT = 50;

/** PushSubscription.toJSON() の形。endpoint は https のみ */
export const pushSubscriptionSchema = z.object({
  endpoint: z.httpUrl().refine((url) => url.startsWith('https://'), {
    message: 'endpoint は https で指定する',
  }),
  expirationTime: z.number().nullable().exactOptional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscriptionJson = z.infer<typeof pushSubscriptionSchema>;

const hourSchema = z.number().int().min(0).max(23);

/** 静かな時間帯（日本時間の時。start 時ちょうどから end 時ちょうどの前まで。日をまたいでよい） */
export const quietHoursSchema = z
  .object({ start: hourSchema, end: hourSchema })
  .refine((q) => q.start !== q.end, { message: '開始と終了は別の時刻にする' });
export type QuietHours = z.infer<typeof quietHoursSchema>;

export const DEFAULT_QUIET_HOURS: QuietHours = { start: 23, end: 7 };

export const notifyConfigSchema = z.object({
  subscription: pushSubscriptionSchema,
  keywords: z
    .array(z.string().trim().min(1).max(NOTIFY_KEYWORD_MAX_LENGTH))
    .max(NOTIFY_KEYWORD_MAX_COUNT),
  /** null なら静かな時間帯を設けない */
  quietHours: quietHoursSchema.nullable(),
});
export type NotifyConfig = z.infer<typeof notifyConfigSchema>;

/**
 * 比較用に文字列を正規化する。全角・半角の英数字や大文字・小文字の違いを無視する。
 * アプリの検索・ミュート語と notifier の注目キーワードで同じ規則を使う。
 */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}
