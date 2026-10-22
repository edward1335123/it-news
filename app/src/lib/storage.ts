import type { z } from 'zod';

/**
 * 端末内（localStorage）への保存。
 * プライベートブラウズや容量超過では読み書きが例外になるので、すべて try/catch で囲み、
 * 失敗しても画面は動き続けるようにする。保存した値は外部入力として扱い、読み込むときに検証する。
 */

/** キーの接頭辞。形式を変えるときは版を上げる */
const KEY_PREFIX = 'itnews:v1:';

export function storageKey(name: string): string {
  return `${KEY_PREFIX}${name}`;
}

function getStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    // 設定によっては localStorage を参照しただけで例外になる
    return undefined;
  }
}

/** 保存した値を読み込む。ない・壊れている・形式が違うときは `fallback` を返す */
export function readStored<T>(name: string, schema: z.ZodType<T>, fallback: T): T {
  let raw: string | null;
  try {
    raw = getStorage()?.getItem(storageKey(name)) ?? null;
  } catch (error) {
    console.warn(`保存した ${name} を読み込めませんでした`, error);
    return fallback;
  }
  if (raw === null) return fallback;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    console.warn(`保存した ${name} が JSON として壊れています`, error);
    return fallback;
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    console.warn(`保存した ${name} の形式が正しくありません`, result.error);
    return fallback;
  }
  return result.data;
}

/** 値を保存する。保存できなかったら false を返す */
export function writeStored(name: string, value: unknown): boolean {
  try {
    const storage = getStorage();
    if (storage === undefined) return false;
    storage.setItem(storageKey(name), JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`${name} を保存できませんでした`, error);
    return false;
  }
}
