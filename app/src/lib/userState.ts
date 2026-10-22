import { articleSchema } from '@itnews/shared';
import type { Article } from '@itnews/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { normalizeText } from './filter';
import { readStored, writeStored } from './storage';

/** 端末内に保存するユーザーの状態（既読・お気に入り・後で読む・設定） */

const DAY = 24 * 60 * 60 * 1000;
/** 既読の記録を残す期間。記事の保持期間（30日）より少し長くする */
export const READ_RETENTION_MS = 45 * DAY;
/** ミュート語の最大文字数 */
export const MUTED_WORD_MAX_LENGTH = 50;

/** 配列の要素を1件ずつ検証し、形式の違う要素だけを捨てる */
function lenientArray<T>(item: z.ZodType<T>) {
  return z.array(z.unknown()).transform((items) =>
    items.flatMap((value) => {
      const result = item.safeParse(value);
      return result.success ? [result.data] : [];
    }),
  );
}

export const prefsSchema = z.object({
  /** 未読のみ表示 */
  unreadOnly: z.boolean().catch(false),
  /** ミュート語。タイトル・抜粋に含む記事を隠す */
  mutedWords: lenientArray(z.string()).catch([]),
  /** OFF にした情報源の ID */
  disabledSources: lenientArray(z.string()).catch([]),
});
export type Prefs = z.infer<typeof prefsSchema>;

export const DEFAULT_PREFS: Prefs = { unreadOnly: false, mutedWords: [], disabledSources: [] };

/** 記事 ID → 既読にした時刻（epoch ミリ秒） */
export const readSchema = z.record(z.string(), z.unknown()).transform((record) => {
  const result: Record<string, number> = {};
  for (const [id, value] of Object.entries(record)) {
    if (typeof value === 'number' && Number.isFinite(value)) result[id] = value;
  }
  return result;
});
export type ReadRecord = z.infer<typeof readSchema>;

/** 保存した記事。news.json から消えても表示できるよう、記事の内容ごと保存する */
const savedItemSchema = z.object({ article: articleSchema, savedAt: z.number() });
export type SavedItem = z.infer<typeof savedItemSchema>;

export const SAVED_LISTS = ['favorite', 'later'] as const;
export type SavedList = (typeof SAVED_LISTS)[number];

export const SAVED_LIST_LABELS: Record<SavedList, string> = {
  favorite: 'お気に入り',
  later: '後で読む',
};

export const savedSchema = z.object({
  favorite: lenientArray(savedItemSchema).catch([]),
  later: lenientArray(savedItemSchema).catch([]),
});
export type Saved = z.infer<typeof savedSchema>;

export const EMPTY_SAVED: Saved = { favorite: [], later: [] };

/** 古い既読の記録を削除する */
export function pruneRead(read: ReadRecord, now: number): ReadRecord {
  return Object.fromEntries(
    Object.entries(read).filter(([, readAt]) => now - readAt < READ_RETENTION_MS),
  );
}

export function markRead(read: ReadRecord, id: string, now: number): ReadRecord {
  return id in read ? read : { ...read, [id]: now };
}

export function isSaved(saved: Saved, list: SavedList, id: string): boolean {
  return saved[list].some((item) => item.article.id === id);
}

/** 保存していなければ先頭に追加し、保存済みなら外す */
export function toggleSaved(saved: Saved, list: SavedList, article: Article, now: number): Saved {
  const items = saved[list];
  const next = isSaved(saved, list, article.id)
    ? items.filter((item) => item.article.id !== article.id)
    : [{ article, savedAt: now }, ...items];
  return { ...saved, [list]: next };
}

/** ミュート語を追加する。空・長すぎる・登録済み（表記ゆれを含む）なら変えない */
export function addMutedWord(prefs: Prefs, word: string): Prefs {
  const trimmed = word.trim();
  if (trimmed === '' || trimmed.length > MUTED_WORD_MAX_LENGTH) return prefs;
  const key = normalizeText(trimmed);
  if (prefs.mutedWords.some((w) => normalizeText(w) === key)) return prefs;
  return { ...prefs, mutedWords: [...prefs.mutedWords, trimmed] };
}

export function removeMutedWord(prefs: Prefs, word: string): Prefs {
  return { ...prefs, mutedWords: prefs.mutedWords.filter((w) => w !== word) };
}

export function setSourceEnabled(prefs: Prefs, sourceId: string, enabled: boolean): Prefs {
  const others = prefs.disabledSources.filter((id) => id !== sourceId);
  return { ...prefs, disabledSources: enabled ? others : [...others, sourceId] };
}

/**
 * 値を端末内に保存し、次回の起動時に読み込む state。
 * `prepare` は読み込んだ直後に1回だけ通す（古い記録の削除など）。
 */
function usePersistentState<T>(
  name: string,
  schema: z.ZodType<T>,
  fallback: T,
  prepare: (value: T) => T = (value) => value,
) {
  const [value, setValue] = useState<T>(() => prepare(readStored(name, schema, fallback)));
  useEffect(() => {
    writeStored(name, value);
  }, [name, value]);
  return [value, setValue] as const;
}

export type UserState = {
  prefs: Prefs;
  read: ReadRecord;
  saved: Saved;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  toggleSaved: (list: SavedList, article: Article) => void;
  updatePrefs: (update: (prefs: Prefs) => Prefs) => void;
};

export function useUserState(): UserState {
  const [prefs, setPrefs] = usePersistentState('prefs', prefsSchema, DEFAULT_PREFS);
  const [read, setRead] = usePersistentState('read', readSchema, {}, (v) =>
    pruneRead(v, Date.now()),
  );
  const [saved, setSaved] = usePersistentState('saved', savedSchema, EMPTY_SAVED);

  const isReadFn = useCallback((id: string) => id in read, [read]);
  const markReadFn = useCallback(
    (id: string) => setRead((prev) => markRead(prev, id, Date.now())),
    [setRead],
  );
  const toggleSavedFn = useCallback(
    (list: SavedList, article: Article) =>
      setSaved((prev) => toggleSaved(prev, list, article, Date.now())),
    [setSaved],
  );

  return useMemo(
    () => ({
      prefs,
      read,
      saved,
      isRead: isReadFn,
      markRead: markReadFn,
      toggleSaved: toggleSavedFn,
      updatePrefs: setPrefs,
    }),
    [prefs, read, saved, isReadFn, markReadFn, toggleSavedFn, setPrefs],
  );
}
