import { CATEGORY_TAGS, TAG_IDS } from '@itnews/shared';
import type { Article, Source, TagId } from '@itnews/shared';
import { AI_CORE, SECURITY_CORE, TAG_RULES } from './keywords';
import type { Keyword } from './keywords';
import type { SourceProfile } from './profiles';

type Matcher = (text: string) => boolean;

/** 比較用に正規化する（全角・半角、大文字・小文字の違いを無視する） */
export function normalizeForMatch(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileKeyword(keyword: Keyword): RegExp {
  if (keyword instanceof RegExp) return keyword;
  const escaped = escapeRegExp(normalizeForMatch(keyword));
  // 英数字だけの語は、単語の一部（"ai" と "maintain" など）に一致させない
  return /^[\x20-\x7e]+$/.test(keyword)
    ? new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`)
    : new RegExp(escaped);
}

/** キーワードのどれかを含むかを判定する関数を作る（文字列は `normalizeForMatch` したものを渡す） */
export function compileKeywords(keywords: readonly Keyword[]): Matcher {
  const patterns = keywords.map(compileKeyword);
  return (text) => patterns.some((p) => p.test(text));
}

export const isAiText = compileKeywords(AI_CORE);
export const isSecurityText = compileKeywords(SECURITY_CORE);
const TAG_MATCHERS = TAG_IDS.map((tag) => ({
  tag,
  requires: TAG_RULES[tag].requires,
  matches: compileKeywords(TAG_RULES[tag].keywords),
}));

const AI_TAB_TAGS: readonly TagId[] = CATEGORY_TAGS.ai;
const SECURITY_TAB_TAGS: readonly TagId[] = CATEGORY_TAGS.security;

const isSecurityOnlyTag = (tag: TagId) => tag.startsWith('sec-');
const isAiOnlyTag = (tag: TagId) => tag.startsWith('ai-') && tag !== 'ai-security';

export type Classification = {
  category: Article['category'];
  tags: TagId[];
  /** キーワード辞書でタグが1つ以上付いたか */
  matchedKeyword: boolean;
};

/**
 * タイトル・抜粋のキーワードと情報源の既定カテゴリから、カテゴリとタグを決める（SPEC 4章）。
 *
 * - 語があいまいなタグ（`requires`）は、AI・セキュリティの話題の記事にだけ付ける
 * - AI とセキュリティの両方の話題なら `ai-security` を付ける
 * - 既定カテゴリが IT 全般の情報源は、付いたタグからカテゴリを決める
 * - AI・セキュリティの記事にタブのタグが付かなければ、情報源の代わりのタグを付ける
 */
export function classify(
  input: { title: string; summary?: string | undefined },
  source: Pick<Source, 'defaultCategory'>,
  profile: SourceProfile,
): Classification {
  const text = normalizeForMatch(`${input.title}\n${input.summary ?? ''}`);
  const direct = TAG_MATCHERS.filter((m) => m.requires === undefined && m.matches(text)).map(
    (m) => m.tag,
  );

  const isAi =
    source.defaultCategory === 'ai' || isAiText(text) || direct.some((t) => t.startsWith('ai-'));
  const isSecurity =
    source.defaultCategory === 'security' || isSecurityText(text) || direct.some(isSecurityOnlyTag);

  const gated = TAG_MATCHERS.filter(
    (m) =>
      ((m.requires === 'ai' && isAi) || (m.requires === 'security' && isSecurity)) &&
      m.matches(text),
  ).map((m) => m.tag);

  const tags = new Set<TagId>([...direct, ...gated]);
  if (isAi && isSecurity) tags.add('ai-security');
  const matchedKeyword = tags.size > 0;
  for (const tag of profile.alwaysTags ?? []) tags.add(tag);

  const category = decideCategory(source.defaultCategory, [...tags]);
  const tabTags =
    category === 'ai' ? AI_TAB_TAGS : category === 'security' ? SECURITY_TAB_TAGS : null;
  if (tabTags !== null && ![...tags].some((t) => tabTags.includes(t))) {
    tags.add(profile.fallbackTag ?? (category === 'ai' ? 'ai-business' : 'sec-incident'));
  }

  // 表示順を揃えるため、SPEC 4章の順に並べる
  return { category, tags: TAG_IDS.filter((t) => tags.has(t)), matchedKeyword };
}

function decideCategory(
  defaultCategory: Article['category'],
  tags: readonly TagId[],
): Article['category'] {
  if (defaultCategory !== 'general') return defaultCategory;
  if (tags.some(isSecurityOnlyTag)) return 'security';
  if (tags.some(isAiOnlyTag)) return 'ai';
  if (tags.includes('ai-security')) return 'security';
  return 'general';
}
