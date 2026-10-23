import type { Article, QuietHours } from '@itnews/shared';
import { z } from 'zod';
import { matchReasons, reasonLabel, reasonPriority } from './rules';
import type { Reason } from './rules';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 1時間あたりに送る通知の上限（まとめの通知も1件と数える） */
export const MAX_PER_HOUR = 5;
/** 公開からこの時間を過ぎた記事は新着とみなさない（初回や長い停止の後に古い記事を送らない） */
export const FRESHNESS_MS = 48 * HOUR;
/** 送信済みの記録を残す期間。新着とみなす期間より十分長くする */
export const SENT_RETENTION_MS = 14 * DAY;

/** 送信済みの記録。Actions のキャッシュで次回に引き継ぐ */
export const notifyStateSchema = z.object({
  /** 記事 ID → 送信（またはまとめの通知に含めた）時刻（epoch ミリ秒） */
  sent: z.record(z.string(), z.number()),
  /** 通知を送った時刻（1時間あたりの上限の判定に使う） */
  deliveries: z.array(z.number()),
});
export type NotifyState = z.infer<typeof notifyStateSchema>;

export const EMPTY_STATE: NotifyState = { sent: {}, deliveries: [] };

/** Service Worker（app/public/push-sw.js）が受け取る通知の内容 */
export type PushPayload = {
  title: string;
  body: string;
  /** 通知をタップしたときに開く URL。省略するとアプリを開く */
  url?: string;
  /** 同じ tag の通知は置き換わる */
  tag: string;
};

export type Candidate = { article: Article; reason: Reason };

/** 日本時間の「時」（0〜23） */
export function jstHour(now: number): number {
  return new Date(now + 9 * HOUR).getUTCHours();
}

/** 静かな時間帯か。start 時から end 時の前まで。start > end なら日をまたぐ */
export function isQuietTime(quietHours: QuietHours | null, now: number): boolean {
  if (quietHours === null) return false;
  const hour = jstHour(now);
  const { start, end } = quietHours;
  return start < end ? start <= hour && hour < end : hour >= start || hour < end;
}

/** 古い記録を捨てる */
export function pruneState(state: NotifyState, now: number): NotifyState {
  return {
    sent: Object.fromEntries(
      Object.entries(state.sent).filter(([, at]) => now - at < SENT_RETENTION_MS),
    ),
    deliveries: state.deliveries.filter((at) => now - at < HOUR),
  };
}

/** 通知条件に当てはまり、まだ送っていない新着記事を、優先度の高い順・新しい順に返す */
export function findCandidates(
  articles: readonly Article[],
  state: NotifyState,
  keywords: readonly string[],
  now: number,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const article of articles) {
    if (Object.hasOwn(state.sent, article.id)) continue;
    const age = now - Date.parse(article.publishedAt);
    if (!(age >= -HOUR && age < FRESHNESS_MS)) continue;
    const [reason] = matchReasons(article, keywords);
    if (reason !== undefined) candidates.push({ article, reason });
  }
  return candidates.sort(
    (a, b) =>
      reasonPriority(a.reason) - reasonPriority(b.reason) ||
      Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt),
  );
}

export function articlePayload({ article, reason }: Candidate): PushPayload {
  return { title: reasonLabel(reason), body: article.title, url: article.url, tag: article.id };
}

/** 上限を超えた分をまとめる通知 */
export function summaryPayload(rest: readonly Candidate[]): PushPayload {
  return {
    title: `ほかに${rest.length}件の新着`,
    body: rest
      .slice(0, 3)
      .map((c) => c.article.title)
      .join('\n'),
    tag: 'summary',
  };
}

export type Plan =
  | { kind: 'none' }
  | { kind: 'quiet'; pending: number }
  | { kind: 'limited'; pending: number }
  | {
      kind: 'send';
      /** 送る通知と、送れたら送信済みにする記事 ID */
      messages: { payload: PushPayload; articleIds: string[] }[];
    };

/**
 * 送る通知を決める。
 * - 静かな時間帯は送らず、送信済みにもしない（時間帯が明けた次の実行で送る）
 * - 1時間あたりの上限の残りで送り切れないときは、最後の1件を残り全部のまとめにする
 */
export function planNotifications(input: {
  articles: readonly Article[];
  state: NotifyState;
  keywords: readonly string[];
  quietHours: QuietHours | null;
  now: number;
  maxPerHour?: number;
}): Plan {
  const { state, now, maxPerHour = MAX_PER_HOUR } = input;
  const candidates = findCandidates(input.articles, state, input.keywords, now);
  if (candidates.length === 0) return { kind: 'none' };
  if (isQuietTime(input.quietHours, now)) return { kind: 'quiet', pending: candidates.length };

  const remaining = maxPerHour - state.deliveries.filter((at) => now - at < HOUR).length;
  if (remaining <= 0) return { kind: 'limited', pending: candidates.length };

  const single = (c: Candidate) => ({ payload: articlePayload(c), articleIds: [c.article.id] });
  if (candidates.length <= remaining) return { kind: 'send', messages: candidates.map(single) };

  const head = candidates.slice(0, remaining - 1);
  const rest = candidates.slice(remaining - 1);
  return {
    kind: 'send',
    messages: [
      ...head.map(single),
      { payload: summaryPayload(rest), articleIds: rest.map((c) => c.article.id) },
    ],
  };
}

/** 送れた通知を記録する */
export function recordDelivery(state: NotifyState, articleIds: readonly string[], now: number) {
  const sent = { ...state.sent };
  for (const id of articleIds) sent[id] = now;
  return { sent, deliveries: [...state.deliveries, now] };
}
