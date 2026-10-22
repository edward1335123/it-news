import { describe, expect, it } from 'vitest';
import { eventEndTime, parseEventTime, toJstIso } from './datetime';

describe('parseEventTime', () => {
  it('タイムゾーンつきの日時はそのまま解釈する', () => {
    expect(parseEventTime('2026-10-29T16:00:00+09:00')).toBe(Date.parse('2026-10-29T07:00:00Z'));
    expect(parseEventTime('2026-10-29T07:00:00.000Z')).toBe(Date.parse('2026-10-29T07:00:00Z'));
  });

  it('タイムゾーンのない日時は日本時間とみなす', () => {
    const expected = Date.parse('2026-10-29T16:00:00+09:00');
    expect(parseEventTime('2026-10-29 16:00:00')).toBe(expected);
    expect(parseEventTime('2026-10-29 16:00')).toBe(expected);
    expect(parseEventTime('2026/10/29 16:00')).toBe(expected);
    expect(parseEventTime('2026-10-29T16:00')).toBe(expected);
    expect(parseEventTime('2026-10-29')).toBe(Date.parse('2026-10-29T00:00:00+09:00'));
  });

  it('空・解釈できない・存在しない日時は undefined', () => {
    expect(parseEventTime(undefined)).toBeUndefined();
    expect(parseEventTime(null)).toBeUndefined();
    expect(parseEventTime('')).toBeUndefined();
    expect(parseEventTime('10月29日')).toBeUndefined();
    expect(parseEventTime('2026-02-30 10:00')).toBeUndefined();
    expect(parseEventTime('2026-10-29 25:00')).toBeUndefined();
  });
});

describe('toJstIso', () => {
  it('日本時間の ISO 8601 にする', () => {
    expect(toJstIso(Date.parse('2026-10-29T07:00:00Z'))).toBe('2026-10-29T16:00:00+09:00');
    expect(toJstIso(Date.parse('2026-10-29T20:30:00Z'))).toBe('2026-10-30T05:30:00+09:00');
  });
});

describe('eventEndTime', () => {
  it('終了日時がなければ開始日の日本時間 24:00 とする', () => {
    expect(eventEndTime({ startAt: '2026-10-29T23:00:00+09:00' })).toBe(
      Date.parse('2026-10-30T00:00:00+09:00'),
    );
    expect(
      eventEndTime({ startAt: '2026-10-29T10:00:00+09:00', endAt: '2026-10-29T12:00:00+09:00' }),
    ).toBe(Date.parse('2026-10-29T12:00:00+09:00'));
  });
});
