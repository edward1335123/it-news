/** イベントの日時の解釈。タイムゾーンのない日時は日本時間とみなす（国内のイベントのため）。 */

const HOUR = 60 * 60 * 1000;
/** 日本時間の UTC からのずれ（夏時間はない） */
const JST_OFFSET = 9 * HOUR;

/** タイムゾーンのない日時（`2026-10-29 16:00:00`・`2026-10-29T16:00`・`2026/10/29 16:00`・`2026-10-29`） */
const LOCAL_DATE_TIME =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
/** タイムゾーンつきの ISO 8601 */
const ZONED_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/** 日時の文字列を epoch ミリ秒にする。解釈できなければ undefined */
export function parseEventTime(value: string | null | undefined): number | undefined {
  const text = value?.trim();
  if (text === undefined || text === '') return undefined;
  if (ZONED_DATE_TIME.test(text)) {
    const ms = Date.parse(text);
    return Number.isNaN(ms) ? undefined : ms;
  }
  const match = LOCAL_DATE_TIME.exec(text);
  if (match === null) return undefined;
  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map((part) => (part === undefined ? 0 : Number(part)));
  const utc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0);
  // 2026-02-30 のような存在しない日付を弾く
  const check = new Date(utc);
  if (check.getUTCMonth() !== (month ?? 1) - 1 || check.getUTCDate() !== day) return undefined;
  if ((hour ?? 0) > 23 || (minute ?? 0) > 59 || (second ?? 0) > 59) return undefined;
  return utc - JST_OFFSET;
}

/** epoch ミリ秒を日本時間の ISO 8601（`2026-10-29T16:00:00+09:00`）にする */
export function toJstIso(ms: number): string {
  return new Date(ms + JST_OFFSET).toISOString().replace(/\.\d{3}Z$/, '+09:00');
}

const DAY = 24 * HOUR;

/** イベントが終わる時刻。終了日時がなければ開始日の終わり（日本時間の 24:00）とする（アプリと同じ） */
export function eventEndTime(event: { startAt: string; endAt?: string }): number {
  if (event.endAt !== undefined) return Date.parse(event.endAt);
  const local = Date.parse(event.startAt) + JST_OFFSET;
  return Math.floor(local / DAY) * DAY + DAY - JST_OFFSET;
}
