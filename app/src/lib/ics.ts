import { EVENT_FORMATS, EVENT_TYPES } from '@itnews/shared';
import type { TechEvent } from '@itnews/shared';

/** イベントを iCalendar（RFC 5545）形式にしてカレンダーに追加できるようにする */

/** 終了日時がないイベントは、開始から1時間の予定にする */
const DEFAULT_DURATION = 60 * 60 * 1000;
/** 1行の最大オクテット数（改行を除く） */
const MAX_LINE_OCTETS = 75;

const encoder = new TextEncoder();

/** 20261022T030000Z の形式（UTC） */
export function formatIcsDate(time: number): string {
  return new Date(time)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** TEXT 型の値のエスケープ（`\` `;` `,` 改行） */
export function escapeIcsText(text: string): string {
  return (
    text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n')
      // 改行以外の制御文字は値に入れられないので取り除く
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
  );
}

/**
 * 75オクテットを超える行を折り返す。続きの行は空白1つで始める。
 * UTF-8 の多バイト文字やサロゲートペアの途中では切らない。
 */
export function foldIcsLine(line: string): string {
  const lines: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // 続きの行は先頭の空白も1オクテットに数える
    const limit = lines.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      lines.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  lines.push(current);
  return lines.join('\r\n ');
}

function location(event: TechEvent): string | undefined {
  const place = [event.venue, event.address].filter((v) => v !== undefined).join(' ');
  if (event.format === 'online') return 'オンライン';
  if (event.format === 'hybrid') return place === '' ? 'オンライン' : `${place}（オンライン併用）`;
  return place === '' ? undefined : place;
}

function description(event: TechEvent): string {
  const lines = [
    `${EVENT_TYPES[event.type].label} / ${EVENT_FORMATS[event.format].label}`,
    event.organizer === undefined ? undefined : `主催: ${event.organizer}`,
    event.url,
  ];
  return lines.filter((v) => v !== undefined).join('\n');
}

/** イベント1件の .ics の内容。行は CRLF で区切る */
export function createIcs(event: TechEvent, now: Date): string {
  const start = Date.parse(event.startAt);
  const end = event.endAt === undefined ? start + DEFAULT_DURATION : Date.parse(event.endAt);
  const place = location(event);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IT News PWA//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.id)}@itnews-pwa`,
    `DTSTAMP:${formatIcsDate(now.getTime())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    place === undefined ? undefined : `LOCATION:${escapeIcsText(place)}`,
    // URL は http/https に限っている（shared のスキーマ）。空白・制御文字が行に入らないよう正規化する
    `URL:${new URL(event.url).href}`,
    `DESCRIPTION:${escapeIcsText(description(event))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines
    .filter((v) => v !== undefined)
    .map(foldIcsLine)
    .join('\r\n')}\r\n`;
}

/** ダウンロードするファイル名。ID の記号は `_` に置き換える */
export function icsFileName(event: TechEvent): string {
  return `event-${event.id.replace(/[^A-Za-z0-9_-]/g, '_')}.ics`;
}

/** .ics を生成してダウンロードする（iOS ではカレンダーへの追加画面が開く想定。実機で要確認） */
export function downloadIcs(event: TechEvent, now: Date = new Date()): void {
  const blob = new Blob([createIcs(event, now)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = icsFileName(event);
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // すぐに破棄するとダウンロードが始まらないブラウザがあるので、少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
