/** 表示用の日時・人数の整形。日時は東京時間で表示する。 */

const TIME_ZONE = 'Asia/Tokyo';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** 時計のずれとして許容する幅 */
const CLOCK_SKEW = 5 * MINUTE;

type TokyoParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: string;
  minute: string;
};

const partsFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function tokyoParts(date: Date): TokyoParts {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** 東京時間の日付のキー（2026-10-22 の形式）。日付ごとに区切るときに使う */
export function tokyoDateKey(iso: string): string {
  const p = tokyoParts(new Date(iso));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * 日付の見出し（今日 / 昨日 / 10月21日（火））。日付は東京時間で数える。
 * 今年でなければ年も出す。
 */
export function formatDayLabel(iso: string, now: Date): string {
  const key = tokyoDateKey(iso);
  if (key === tokyoDateKey(now.toISOString())) return '今日';
  // 東京には夏時間がないので、24時間前は必ず前日になる
  if (key === tokyoDateKey(new Date(now.getTime() - DAY).toISOString())) return '昨日';
  const p = tokyoParts(new Date(iso));
  const date = `${p.month}月${p.day}日（${p.weekday}）`;
  return p.year === tokyoParts(now).year ? date : `${p.year}年${date}`;
}

/** 2026年10月22日 11:30 の形式 */
export function formatDateTime(iso: string): string {
  const p = tokyoParts(new Date(iso));
  return `${p.year}年${p.month}月${p.day}日 ${p.hour}:${p.minute}`;
}

/**
 * 公開日時を相対表示する（たった今 / N分前 / N時間前 / N日前）。
 * 7日以上前と未来の日時は日付で表示する。
 * 収集側と端末の時計のずれを見込み、5分先までの日時は「たった今」とする。
 */
export function formatRelativeTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff >= -CLOCK_SKEW && diff < MINUTE) return 'たった今';
  if (diff >= 0) {
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
    if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}日前`;
  }
  const p = tokyoParts(date);
  const sameYear = p.year === tokyoParts(now).year;
  return sameYear ? `${p.month}月${p.day}日` : `${p.year}年${p.month}月${p.day}日`;
}

export type EventDate = {
  /** カードの日付欄に出す開始日 */
  month: number;
  day: number;
  weekday: string;
  /** 開催期間（例: 10/28(水) 10:00〜10/30(金) 17:00） */
  range: string;
};

export function formatEventDate(startAt: string, endAt?: string): EventDate {
  const start = tokyoParts(new Date(startAt));
  const startLabel = `${start.month}/${start.day}(${start.weekday}) ${start.hour}:${start.minute}`;
  let range = startLabel;
  if (endAt !== undefined) {
    const end = tokyoParts(new Date(endAt));
    const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
    const endLabel = sameDay
      ? `${end.hour}:${end.minute}`
      : `${end.month}/${end.day}(${end.weekday}) ${end.hour}:${end.minute}`;
    range = `${startLabel}〜${endLabel}`;
  }
  return { month: start.month, day: start.day, weekday: start.weekday, range };
}

/** 参加人数の表示。どちらもなければ undefined */
export function formatParticipants(capacity?: number, accepted?: number): string | undefined {
  if (capacity !== undefined && accepted !== undefined) {
    // connpass では補欠を含めて定員を超えることがある
    const over = accepted > capacity ? '（定員超過）' : '';
    return `${accepted}/${capacity}人${over}`;
  }
  if (capacity !== undefined) return `定員${capacity}人`;
  if (accepted !== undefined) return `参加${accepted}人`;
  return undefined;
}
