import { CATEGORY_TAGS, sourceSchema, sourcesFileSchema } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import sourcesJson from '../../../app/public/data/sources.json';
import { SOURCE_PROFILES } from './profiles';

/** 登録した情報源（app/public/data/sources.json）と collector の設定の整合性 */
describe('sources.json', () => {
  const { sources } = sourcesFileSchema.parse(sourcesJson);
  const byId = new Map(sources.map((s) => [s.id, s]));

  it('スキーマにないキーを含まない', () => {
    for (const s of sourcesJson.sources) {
      expect(sourceSchema.strict().safeParse(s).error?.issues, s.id).toBeUndefined();
    }
  });

  it('フィードの URL が重複しない', () => {
    expect(new Set(sources.map((s) => s.feed)).size).toBe(sources.length);
  });

  it('情報源の設定は登録した情報源だけを対象にする', () => {
    for (const id of Object.keys(SOURCE_PROFILES)) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it('代わりのタグは、情報源の既定カテゴリのタブのタグにする', () => {
    for (const [id, profile] of Object.entries(SOURCE_PROFILES)) {
      const category = byId.get(id)?.defaultCategory;
      if (profile?.fallbackTag === undefined || category === undefined) continue;
      expect(category, id).not.toBe('general');
      if (category === 'general') continue;
      const tabTags: readonly TagId[] = CATEGORY_TAGS[category];
      expect(tabTags, id).toContain(profile.fallbackTag);
    }
  });
});
