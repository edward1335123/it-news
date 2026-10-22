import { SUMMARY_MAX_LENGTH } from '@itnews/shared';
import type { Article, Source } from '@itnews/shared';
import { classify } from './classify';
import { mergeArticles } from './dedupe';
import { parseFeed } from './feed';
import type { FeedItem } from './feed';
import { profileOf } from './profiles';
import { scoreArticle } from './score';
import { toPlainText, truncate } from './text';
import { articleId, cleanUrl, urlKey } from './url';

const DAY = 24 * 60 * 60 * 1000;

/** 記事の保持期間（SPEC 7章） */
export const RETENTION_MS = 30 * DAY;
/** 1回の取得で取り込む件数の既定値（全件を配信するフィードがあるため） */
export const DEFAULT_MAX_ITEMS = 50;
/** 情報源ごとに残す記事の上限（news.json が大きくなりすぎないように） */
export const MAX_ARTICLES_PER_SOURCE = 100;

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type SourceOutcome =
  { source: Source; ok: true; items: FeedItem[] } | { source: Source; ok: false; error: string };

/** arXiv の説明文の前置き（「arXiv:xxxx Announce Type: new Abstract:」）を除く */
function cleanSummary(summary: string): string {
  return summary.replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s+Abstract:\s*/i, '');
}

/** フィードの項目を記事にする（正規化・分類）。新しい順に、情報源の上限件数まで返す */
export function toArticles(source: Source, items: readonly FeedItem[], now: number): Article[] {
  const profile = profileOf(source.id);
  const seen = new Set<string>();
  const articles: Article[] = [];

  for (const item of items) {
    const url = cleanUrl(item.url, source.feed);
    const title = toPlainText(item.title);
    if (url === null || title === '') continue;
    const id = articleId(url);
    if (seen.has(id)) continue;

    // 日時がない項目は見つけた時刻にする。未来の日時は今に揃える
    const published = Math.min(
      now,
      item.publishedAt === undefined ? now : Date.parse(item.publishedAt),
    );
    if (now - published > RETENTION_MS) continue;

    let summary: string | undefined;
    if (profile.summary !== false && item.summary !== undefined) {
      const text = cleanSummary(toPlainText(item.summary));
      if (text !== '' && text !== title) summary = truncate(text, SUMMARY_MAX_LENGTH);
    }

    const { category, tags, matchedKeyword } = classify({ title, summary }, source, profile);
    if (profile.requireKeywordTag === true && !matchedKeyword) continue;

    seen.add(id);
    articles.push({
      id,
      title,
      url,
      source: source.id,
      lang: source.lang,
      publishedAt: new Date(published).toISOString(),
      ...(summary === undefined ? {} : { summary }),
      category,
      tags,
      score: 0,
      related: [],
    });
  }

  return sortNewest(articles).slice(0, profile.maxItems ?? DEFAULT_MAX_ITEMS);
}

function sortNewest(articles: Article[]): Article[] {
  return articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** 情報源ごとに新しい記事から上限件数まで残す（`articles` は新しい順） */
function capPerSource(articles: readonly Article[]): Article[] {
  const counts = new Map<string, number>();
  return articles.filter((a) => {
    const count = (counts.get(a.source) ?? 0) + 1;
    counts.set(a.source, count);
    return count <= MAX_ARTICLES_PER_SOURCE;
  });
}

/** Hacker News の項目の URL → ポイント */
function collectHnPoints(outcomes: readonly SourceOutcome[]): Map<string, number> {
  const points = new Map<string, number>();
  for (const outcome of outcomes) {
    if (!outcome.ok) continue;
    for (const item of outcome.items) {
      const url = item.points === undefined ? null : cleanUrl(item.url, outcome.source.feed);
      if (url === null || item.points === undefined) continue;
      const key = urlKey(url);
      points.set(key, Math.max(points.get(key) ?? 0, item.points));
    }
  }
  return points;
}

/**
 * 前回の news.json と今回の取得結果から、新しい記事一覧を作る。
 * 30日より古い記事と sources.json にない情報源の記事を除き、重複をまとめ、注目度を計算する。
 */
export function buildNews(input: {
  previous: readonly Article[];
  outcomes: readonly SourceOutcome[];
  sources: readonly Source[];
  now: number;
}): Article[] {
  const { previous, outcomes, sources, now } = input;
  const known = new Set(sources.map((s) => s.id));
  const isFresh = (a: Article) => now - Date.parse(a.publishedAt) <= RETENTION_MS;

  const kept = previous
    .filter((a) => known.has(a.source) && isFresh(a))
    .map((a) => ({ ...a, related: a.related.filter((r) => known.has(r.source)) }));
  const incoming = outcomes.flatMap((o) => (o.ok ? toArticles(o.source, o.items, now) : []));
  const merged = sortNewest(mergeArticles(kept, incoming));

  const hnPoints = collectHnPoints(outcomes);
  const context = {
    now,
    isPrimary: (sourceId: string) => profileOf(sourceId).primary === true,
    hnPoints: (article: Article) => {
      const values = [article.url, ...article.related.map((r) => r.url)].flatMap(
        (url) => hnPoints.get(urlKey(url)) ?? [],
      );
      return values.length === 0 ? undefined : Math.max(...values);
    },
  };
  return capPerSource(merged).map((a) => ({ ...a, score: scoreArticle(a, context) }));
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // fetch の失敗は cause に原因（DNS・TLS など）が入る
  return error.cause instanceof Error
    ? `${error.message}（${error.cause.message}）`
    : error.message;
}

/**
 * すべての情報源を取得して記事一覧を作る。
 * 取得・解析に失敗した情報源はログに残して飛ばし、他の情報源の処理は続ける。
 */
export async function collectNews(input: {
  sources: readonly Source[];
  previous: readonly Article[];
  fetchFeed: (url: string) => Promise<string>;
  now: number;
  log: Logger;
}): Promise<{ articles: Article[]; failures: { sourceId: string; error: string }[] }> {
  const { sources, previous, fetchFeed, now, log } = input;

  const outcomes = await Promise.all(
    sources.map(async (source): Promise<SourceOutcome> => {
      try {
        const items = parseFeed(await fetchFeed(source.feed));
        if (items.length === 0) log.warn(`[news] ${source.id}: 記事が0件`);
        else log.info(`[news] ${source.id}: ${items.length}件`);
        return { source, ok: true, items };
      } catch (error) {
        const message = errorMessage(error);
        log.error(`[news] ${source.id}: 取得に失敗（${source.feed}）: ${message}`);
        return { source, ok: false, error: message };
      }
    }),
  );

  const failures = outcomes.flatMap((o) =>
    o.ok ? [] : [{ sourceId: o.source.id, error: o.error }],
  );
  return { articles: buildNews({ previous, outcomes, sources, now }), failures };
}
