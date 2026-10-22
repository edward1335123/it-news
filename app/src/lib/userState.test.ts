import type { Article } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  EMPTY_SAVED,
  MUTED_WORD_MAX_LENGTH,
  READ_RETENTION_MS,
  addMutedWord,
  hasRead,
  isSaved,
  markRead,
  prefsSchema,
  pruneRead,
  readSchema,
  removeMutedWord,
  savedSchema,
  setSourceEnabled,
  toggleSaved,
} from './userState';

const article = (id: string): Article => ({
  id,
  title: id,
  url: `https://example.com/${id}`,
  source: 'example',
  lang: 'ja',
  publishedAt: '2026-10-22T00:00:00Z',
  category: 'ai',
  tags: ['ai-dev'],
  score: 0,
  related: [],
});

describe('保存する値のスキーマ', () => {
  it('設定の項目が壊れていれば、その項目だけ既定値にする', () => {
    expect(
      prefsSchema.parse({ unreadOnly: 'yes', mutedWords: ['求人', 1], disabledSources: ['zenn'] }),
    ).toEqual({ unreadOnly: false, mutedWords: ['求人'], disabledSources: ['zenn'] });
    expect(prefsSchema.parse({})).toEqual(DEFAULT_PREFS);
  });

  it('既読の記録から数値でない値を捨てる', () => {
    expect(readSchema.parse({ a: 1, b: 'x', c: null, d: Number.NaN })).toEqual({ a: 1 });
  });

  it('保存した記事のうち形式の違うものだけを捨てる', () => {
    const valid = { article: article('a'), savedAt: 1 };
    const parsed = savedSchema.parse({
      favorite: [valid, { article: { id: 'broken' }, savedAt: 2 }],
      later: 'broken',
    });
    expect(parsed).toEqual({ favorite: [valid], later: [] });
  });
});

describe('既読', () => {
  it('既読にした時刻を記録し、2回目は変えない', () => {
    const read = markRead({}, 'a', 100);
    expect(read).toEqual({ a: 100 });
    expect(markRead(read, 'a', 200)).toBe(read);
  });

  it('プロトタイプのキーを既読と判定しない', () => {
    expect(hasRead({}, 'constructor')).toBe(false);
    expect(hasRead({}, 'toString')).toBe(false);
    expect(markRead({}, 'constructor', 100)).toEqual({ constructor: 100 });
  });

  it('保持期間を過ぎた記録を削除する', () => {
    const now = 10 * READ_RETENTION_MS;
    const read = { old: now - READ_RETENTION_MS, recent: now - READ_RETENTION_MS + 1 };
    expect(pruneRead(read, now)).toEqual({ recent: read.recent });
  });
});

describe('お気に入り・後で読む', () => {
  it('追加すると先頭に入り、もう一度で外れる。リストごとに独立している', () => {
    let saved = toggleSaved(EMPTY_SAVED, 'favorite', article('a'), 1);
    saved = toggleSaved(saved, 'favorite', article('b'), 2);
    expect(saved.favorite.map((i) => i.article.id)).toEqual(['b', 'a']);
    expect(saved.favorite[0]?.savedAt).toBe(2);
    expect(isSaved(saved, 'favorite', 'a')).toBe(true);
    expect(isSaved(saved, 'later', 'a')).toBe(false);

    saved = toggleSaved(saved, 'favorite', article('a'), 3);
    expect(saved.favorite.map((i) => i.article.id)).toEqual(['b']);
    expect(EMPTY_SAVED).toEqual({ favorite: [], later: [] });
  });
});

describe('ミュート語', () => {
  it('前後の空白を除いて追加し、表記ゆれの重複・空・長すぎる語は追加しない', () => {
    let prefs = addMutedWord(DEFAULT_PREFS, '  求人 ');
    prefs = addMutedWord(prefs, 'PR');
    expect(prefs.mutedWords).toEqual(['求人', 'PR']);
    expect(addMutedWord(prefs, 'ｐｒ')).toBe(prefs);
    expect(addMutedWord(prefs, '   ')).toBe(prefs);
    expect(addMutedWord(prefs, 'あ'.repeat(MUTED_WORD_MAX_LENGTH + 1))).toBe(prefs);
    expect(removeMutedWord(prefs, '求人').mutedWords).toEqual(['PR']);
  });
});

describe('情報源の ON/OFF', () => {
  it('OFF にした ID を記録し、ON で外す。重複して記録しない', () => {
    let prefs = setSourceEnabled(DEFAULT_PREFS, 'zenn', false);
    prefs = setSourceEnabled(prefs, 'zenn', false);
    expect(prefs.disabledSources).toEqual(['zenn']);
    expect(setSourceEnabled(prefs, 'zenn', true).disabledSources).toEqual([]);
  });
});
