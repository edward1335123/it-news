import type { TechEvent } from '@itnews/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createIcs,
  downloadIcs,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
  icsFileName,
} from './ics';
import { stubObjectUrl } from '../test/stubObjectUrl';
import type { ObjectUrlStub } from '../test/stubObjectUrl';

const encoder = new TextEncoder();
const now = new Date('2026-10-22T12:34:56.789+09:00');

const event: TechEvent = {
  id: 'connpass-1010',
  title: 'AI エージェント勉強会 #12',
  url: 'https://example.com/event/1010?ref=a,b',
  source: 'connpass',
  type: 'meetup',
  format: 'hybrid',
  startAt: '2026-10-24T19:00:00+09:00',
  endAt: '2026-10-24T21:00:00+09:00',
  venue: '渋谷某所 イベントスペース',
  address: '東京都渋谷区渋谷2-21-1',
  organizer: 'AI Agents Tokyo',
  tags: ['ai-agent'],
};

/** 折り返しを戻して行に分ける */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n');
}

describe('formatIcsDate', () => {
  it('UTC の基本形式にする（ミリ秒は切り捨てる）', () => {
    expect(formatIcsDate(now.getTime())).toBe('20261022T033456Z');
  });
});

describe('escapeIcsText', () => {
  it('バックスラッシュ・セミコロン・カンマ・改行をエスケープする', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng');
  });

  it('改行以外の制御文字を取り除く', () => {
    expect(escapeIcsText('a\tb\u0000c\u007fd')).toBe('abcd');
  });
});

describe('foldIcsLine', () => {
  it('75オクテット以下の行はそのまま', () => {
    const line = 'A'.repeat(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it('75オクテットを超えると空白で始まる行に折り返す', () => {
    const folded = foldIcsLine('A'.repeat(200));
    const lines = folded.split('\r\n');
    expect(lines.map((l) => encoder.encode(l).length)).toEqual([75, 75, 52]);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(unfold(folded)).toEqual(['A'.repeat(200)]);
  });

  it('マルチバイト文字・絵文字の途中で切らない', () => {
    const line = `SUMMARY:${'あ'.repeat(30)}${'😀'.repeat(10)}`;
    const folded = foldIcsLine(line);
    for (const part of folded.split('\r\n')) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
      expect(part).not.toContain('�');
      // サロゲートペアが分かれていない
      expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(part)).toBe(false);
    }
    expect(unfold(folded)).toEqual([line]);
  });
});

describe('createIcs', () => {
  it('VEVENT を1件持つ iCalendar を CRLF 区切りで作る', () => {
    const ics = createIcs(event, now);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const lines = unfold(ics);
    expect(lines.slice(0, 6)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//IT News PWA//JA',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
    ]);
    expect(lines).toContain('UID:connpass-1010@itnews-pwa');
    expect(lines).toContain('DTSTAMP:20261022T033456Z');
    expect(lines).toContain('DTSTART:20261024T100000Z');
    expect(lines).toContain('DTEND:20261024T120000Z');
    expect(lines).toContain('SUMMARY:AI エージェント勉強会 #12');
    expect(lines).toContain(
      'LOCATION:渋谷某所 イベントスペース 東京都渋谷区渋谷2-21-1（オンライン併用）',
    );
    // URL 型はエスケープしない
    expect(lines).toContain('URL:https://example.com/event/1010?ref=a,b');
    expect(lines).toContain(
      'DESCRIPTION:勉強会 / ハイブリッド\\n主催: AI Agents Tokyo\\nhttps://example.com/event/1010?ref=a\\,b',
    );
    expect(lines.slice(-3)).toEqual(['END:VEVENT', 'END:VCALENDAR', '']);
  });

  it('すべての行が75オクテット以下になる', () => {
    const long = { ...event, title: 'とても長いタイトル'.repeat(20) };
    for (const line of createIcs(long, now).split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('タイトルの記号・改行をエスケープする', () => {
    const lines = unfold(createIcs({ ...event, title: 'A, B; C\nD' }, now));
    expect(lines).toContain('SUMMARY:A\\, B\\; C\\nD');
  });

  it('終了日時がなければ開始から1時間とし、場所がなければ LOCATION を出さない', () => {
    const minimal: TechEvent = {
      id: 'e2',
      title: 'オフライン会',
      url: 'https://example.com/e2',
      source: 'manual',
      type: 'meetup',
      format: 'offline',
      startAt: '2026-11-25T20:00:00+09:00',
      tags: [],
    };
    const lines = unfold(createIcs(minimal, now));
    expect(lines).toContain('DTSTART:20261125T110000Z');
    expect(lines).toContain('DTEND:20261125T120000Z');
    expect(lines.some((l) => l.startsWith('LOCATION:'))).toBe(false);
    expect(lines).toContain('DESCRIPTION:勉強会 / 東京\\nhttps://example.com/e2');
  });

  it('オンライン開催の場所は「オンライン」', () => {
    const lines = unfold(createIcs({ ...event, format: 'online' }, now));
    expect(lines).toContain('LOCATION:オンライン');
  });
});

describe('icsFileName', () => {
  it('ID の記号を置き換える', () => {
    expect(icsFileName(event)).toBe('event-connpass-1010.ics');
    expect(icsFileName({ ...event, id: '../a b/c' })).toBe('event-___a_b_c.ics');
  });
});

describe('downloadIcs', () => {
  let objectUrl: ObjectUrlStub;

  afterEach(() => {
    objectUrl.restore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('text/calendar の Blob を作ってダウンロードし、あとで URL を破棄する', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    objectUrl = stubObjectUrl('blob:ics');
    const revokeObjectURL = objectUrl.revoke;
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ download: this.download, href: this.href });
    });

    downloadIcs(event, now);

    expect(clicked).toEqual([{ download: 'event-connpass-1010.ics', href: 'blob:ics' }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:ics');

    vi.useRealTimers();
    const [blob] = objectUrl.blobs;
    expect(objectUrl.blobs).toHaveLength(1);
    expect(blob?.type).toBe('text/calendar;charset=utf-8');
    expect(await blob?.text()).toBe(createIcs(event, now));
  });
});
