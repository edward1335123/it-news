import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_TAGS, EVENT_FORMATS, EVENT_TYPES, TAG_IDS, TAGS } from './taxonomy';

const HEX_COLOR = /^#[0-9a-f]{6}$/;

describe('taxonomy', () => {
  it('すべてのタグがどちらかのタブに属する', () => {
    const listed = new Set<string>([...CATEGORY_TAGS.ai, ...CATEGORY_TAGS.security]);
    expect([...listed].sort()).toEqual([...TAG_IDS].sort());
  });

  it('ai-security は AI とセキュリティの両方に表示する', () => {
    expect(CATEGORY_TAGS.ai).toContain('ai-security');
    expect(CATEGORY_TAGS.security).toContain('ai-security');
  });

  it('タブ内でタグが重複しない', () => {
    for (const tags of Object.values(CATEGORY_TAGS)) {
      expect(new Set(tags).size).toBe(tags.length);
    }
  });

  it('表示名と色が定義されている', () => {
    const definitions = [
      ...Object.values(CATEGORIES),
      ...Object.values(TAGS),
      ...Object.values(EVENT_TYPES),
      ...Object.values(EVENT_FORMATS),
    ];
    for (const { label, color } of definitions) {
      expect(label).not.toBe('');
      expect(color).toMatch(HEX_COLOR);
    }
  });
});
