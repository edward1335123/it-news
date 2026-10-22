import { describe, expect, it } from 'vitest';
import { formatDateTime, formatEventDate, formatParticipants, formatRelativeTime } from './format';

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-22T12:00:00+09:00');

  it.each([
    ['2026-10-22T11:59:30+09:00', 'たった今'],
    ['2026-10-22T11:59:00+09:00', '1分前'],
    ['2026-10-22T11:01:00+09:00', '59分前'],
    ['2026-10-22T11:00:00+09:00', '1時間前'],
    ['2026-10-21T12:00:01+09:00', '23時間前'],
    ['2026-10-21T12:00:00+09:00', '1日前'],
    ['2026-10-15T12:00:01+09:00', '6日前'],
    ['2026-10-15T12:00:00+09:00', '10月15日'],
    ['2025-12-31T23:00:00+09:00', '2025年12月31日'],
    // 時計のずれを見込み、5分先までは「たった今」
    ['2026-10-22T12:05:00+09:00', 'たった今'],
    // それより先の日時は日付で出す
    ['2026-10-22T12:05:01+09:00', '10月22日'],
    ['2026-10-23T09:00:00+09:00', '10月23日'],
  ])('%s → %s', (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });

  it('日付は東京時間で数える', () => {
    // UTC では 10/14 だが東京では 10/15
    expect(formatRelativeTime('2026-10-14T16:00:00Z', now)).toBe('10月15日');
  });
});

describe('formatDateTime', () => {
  it('東京時間の日時を返す', () => {
    expect(formatDateTime('2026-10-22T02:30:00.000Z')).toBe('2026年10月22日 11:30');
  });
});

describe('formatEventDate', () => {
  it('同じ日に終わるイベントは終了時刻だけを出す', () => {
    expect(formatEventDate('2026-10-28T19:00:00+09:00', '2026-10-28T21:00:00+09:00')).toEqual({
      month: 10,
      day: 28,
      weekday: '水',
      range: '10/28(水) 19:00〜21:00',
    });
  });

  it('複数日にわたるイベントは終了日も出す', () => {
    expect(formatEventDate('2026-10-28T10:00:00+09:00', '2026-10-30T17:00:00+09:00').range).toBe(
      '10/28(水) 10:00〜10/30(金) 17:00',
    );
  });

  it('終了日時がなければ開始日時だけを出す', () => {
    expect(formatEventDate('2026-11-01T00:00:00Z').range).toBe('11/1(日) 09:00');
  });
});

describe('formatParticipants', () => {
  it.each([
    [80, 45, '45/80人'],
    [80, 80, '80/80人'],
    [80, 96, '96/80人（定員超過）'],
    [100, undefined, '定員100人'],
    [undefined, 30, '参加30人'],
    [undefined, undefined, undefined],
  ])('capacity=%s accepted=%s → %s', (capacity, accepted, expected) => {
    expect(formatParticipants(capacity, accepted)).toBe(expected);
  });
});
