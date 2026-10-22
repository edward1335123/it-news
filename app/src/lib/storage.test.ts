import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { readStored, storageKey, writeStored } from './storage';

const schema = z.object({ count: z.number() });
const fallback = { count: 0 };

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('保存した値を読み込める', () => {
    expect(writeStored('test', { count: 3 })).toBe(true);
    expect(localStorage.getItem(storageKey('test'))).toBe('{"count":3}');
    expect(readStored('test', schema, fallback)).toEqual({ count: 3 });
  });

  it('保存した値がなければ fallback を返す', () => {
    expect(readStored('test', schema, fallback)).toBe(fallback);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('JSON として壊れていれば fallback を返す', () => {
    localStorage.setItem(storageKey('test'), '{broken');
    expect(readStored('test', schema, fallback)).toBe(fallback);
    expect(console.warn).toHaveBeenCalled();
  });

  it('形式が違えば fallback を返す', () => {
    localStorage.setItem(storageKey('test'), '{"count":"3"}');
    expect(readStored('test', schema, fallback)).toBe(fallback);
  });

  it('読み込みで例外が出ても fallback を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStored('test', schema, fallback)).toBe(fallback);
  });

  it('localStorage を参照できなくても fallback を返す', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStored('test', schema, fallback)).toBe(fallback);
    expect(writeStored('test', { count: 1 })).toBe(false);
  });

  it('保存で例外が出ても止まらず false を返す', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(writeStored('test', { count: 1 })).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});
