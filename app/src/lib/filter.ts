import { CATEGORY_TAGS } from '@itnews/shared';
import type { Article, TagId, TechEvent } from '@itnews/shared';

/** サブカテゴリのチップで絞り込むニュースのタブ */
export type NewsTab = keyof typeof CATEGORY_TAGS;

/**
 * タブに表示する記事を新しい順に返す。
 * タブのサブカテゴリのタグを1つ以上持つ記事を表示するので、`ai-security` は両方のタブに出る。
 * `tag` を指定するとそのサブカテゴリだけに絞り込む。
 */
export function articlesForTab(
  articles: readonly Article[],
  tab: NewsTab,
  tag: TagId | null,
): Article[] {
  const tabTags: readonly TagId[] = CATEGORY_TAGS[tab];
  return articles
    .filter((a) => (tag === null ? a.tags.some((t) => tabTags.includes(t)) : a.tags.includes(tag)))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** イベントを開催日が近い順に返す */
export function sortEvents(events: readonly TechEvent[]): TechEvent[] {
  return [...events].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
