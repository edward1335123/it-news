import { z } from 'zod';
import {
  CATEGORY_IDS,
  EVENT_FORMAT_IDS,
  EVENT_SOURCE_IDS,
  EVENT_TYPE_IDS,
  TAG_IDS,
} from './taxonomy';

/**
 * SPEC 5章のデータ形式。型は `z.infer` で導出し、スキーマを正とする。
 * 任意項目は `.exactOptional()` を使い、`exactOptionalPropertyTypes` と整合させる。
 */

/** 記事の抜粋の最大文字数（collector はこの長さに切り詰める） */
export const SUMMARY_MAX_LENGTH = 200;

const isoDateTime = z.iso.datetime({ offset: true });
/** http/https のみ許可する（javascript: などを弾く） */
const webUrl = z.httpUrl();
const nonEmpty = z.string().min(1);

export const sourceIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: '情報源IDは小文字英数字とハイフンで指定する',
});
export const categoryIdSchema = z.enum(CATEGORY_IDS);
export const tagIdSchema = z.enum(TAG_IDS);
export const langSchema = z.enum(['ja', 'en']);

const tagsSchema = z
  .array(tagIdSchema)
  .refine((tags) => new Set(tags).size === tags.length, { message: 'タグが重複している' });

export const sourceSchema = z.object({
  id: sourceIdSchema,
  name: nonEmpty,
  url: webUrl,
  feed: webUrl,
  lang: langSchema,
  defaultCategory: categoryIdSchema,
});
export type Source = z.infer<typeof sourceSchema>;

export const articleSchema = z.object({
  /** 正規化URLのハッシュ */
  id: nonEmpty,
  title: nonEmpty,
  url: webUrl,
  /** Source.id */
  source: sourceIdSchema,
  lang: langSchema,
  publishedAt: isoDateTime,
  /** RSSの抜粋 */
  summary: z.string().max(SUMMARY_MAX_LENGTH).exactOptional(),
  category: categoryIdSchema,
  tags: tagsSchema,
  /** 注目度 */
  score: z.number().nonnegative(),
  /** 重複としてまとめた他の報道 */
  related: z.array(z.object({ source: sourceIdSchema, url: webUrl })),
});
export type Article = z.infer<typeof articleSchema>;

export const eventSchema = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    url: webUrl,
    source: z.enum(EVENT_SOURCE_IDS),
    type: z.enum(EVENT_TYPE_IDS),
    format: z.enum(EVENT_FORMAT_IDS),
    startAt: isoDateTime,
    endAt: isoDateTime.exactOptional(),
    venue: nonEmpty.exactOptional(),
    address: nonEmpty.exactOptional(),
    organizer: nonEmpty.exactOptional(),
    capacity: z.int().nonnegative().exactOptional(),
    accepted: z.int().nonnegative().exactOptional(),
    tags: tagsSchema,
  })
  .refine((e) => e.endAt === undefined || Date.parse(e.endAt) >= Date.parse(e.startAt), {
    message: 'endAt は startAt 以降にする',
    path: ['endAt'],
  });
export type Event = z.infer<typeof eventSchema>;

function uniqueIds<T extends { id: string }>(items: T[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

/** app/public/data/news.json */
export const newsFileSchema = z.object({
  generatedAt: isoDateTime,
  articles: z.array(articleSchema).refine(uniqueIds, { message: '記事IDが重複している' }),
});
export type NewsFile = z.infer<typeof newsFileSchema>;

/** app/public/data/events.json */
export const eventsFileSchema = z.object({
  generatedAt: isoDateTime,
  events: z.array(eventSchema).refine(uniqueIds, { message: 'イベントIDが重複している' }),
});
export type EventsFile = z.infer<typeof eventsFileSchema>;

/** app/public/data/sources.json */
export const sourcesFileSchema = z.object({
  sources: z.array(sourceSchema).refine(uniqueIds, { message: '情報源IDが重複している' }),
});
export type SourcesFile = z.infer<typeof sourcesFileSchema>;
