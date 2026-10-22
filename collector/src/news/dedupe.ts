import { TAG_IDS } from '@itnews/shared';
import type { Article } from '@itnews/shared';
import { urlKey } from './url';

const HOUR = 60 * 60 * 1000;

/**
 * タイトルの類似度（0〜1）がこれ以上なら同じ話題の報道とみなす。
 * 実データでは、同じ話題の別媒体の見出しは 0.6 以上、無関係な見出しは 0.57 以下だった
 */
export const TITLE_SIMILARITY_THRESHOLD = 0.6;
/** 短いタイトル（正規化後の文字数）は偶然似やすいので比べない */
export const MIN_TITLE_KEY_LENGTH = 10;
/** 公開日時がこの範囲内の記事どうしだけ比べる（毎週同じ題名の連載をまとめないため） */
export const DUPLICATE_WINDOW_MS = 72 * HOUR;

/** 比較用のタイトル。全角・半角、大文字・小文字、記号・空白の違いを無視する */
export function titleKey(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function bigrams(key: string): Set<string> {
  const chars = Array.from(key);
  const grams = new Set<string>();
  for (let i = 0; i < chars.length - 1; i += 1) grams.add(`${chars[i]}${chars[i + 1]}`);
  return grams;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/** タイトルの類似度（文字の2-gram の Dice 係数） */
export function titleSimilarity(a: string, b: string): number {
  const ka = titleKey(a);
  const kb = titleKey(b);
  if (ka === kb) return 1;
  return dice(bigrams(ka), bigrams(kb));
}

type Cluster = {
  article: Article;
  grams: Set<string>;
  comparable: boolean;
  time: number;
  /** 代表とまとめた報道の情報源 */
  sources: Set<string>;
};

function toCluster(article: Article): Cluster {
  const key = titleKey(article.title);
  return {
    article,
    grams: bigrams(key),
    comparable: Array.from(key).length >= MIN_TITLE_KEY_LENGTH,
    time: Date.parse(article.publishedAt),
    sources: new Set([article.source, ...article.related.map((r) => r.source)]),
  };
}

/** 同じ話題の記事を探す。同じ情報源の記事どうしはまとめない */
function findDuplicate(clusters: readonly Cluster[], candidate: Cluster): Cluster | undefined {
  if (!candidate.comparable) return undefined;
  let best: Cluster | undefined;
  let bestScore = TITLE_SIMILARITY_THRESHOLD;
  for (const cluster of clusters) {
    if (!cluster.comparable || cluster.article.lang !== candidate.article.lang) continue;
    if (cluster.sources.has(candidate.article.source)) continue;
    if (Math.abs(cluster.time - candidate.time) > DUPLICATE_WINDOW_MS) continue;
    const small = Math.min(cluster.grams.size, candidate.grams.size);
    const large = Math.max(cluster.grams.size, candidate.grams.size);
    // 2-gram の数が違いすぎると Dice 係数はしきい値に届かない
    if (small * (2 - TITLE_SIMILARITY_THRESHOLD) < large * TITLE_SIMILARITY_THRESHOLD) continue;
    const score = dice(cluster.grams, candidate.grams);
    if (score >= bestScore) {
      best = cluster;
      bestScore = score;
    }
  }
  return best;
}

/**
 * 記事の重複を除く（SPEC 7章）。
 * 正規化 URL が一致するもの（既存の記事やまとめた報道を含む）は捨て、
 * タイトルが似ている別の情報源の記事は、既にある記事（前回の記事、または今回の記事のうち先に公開されたもの）の
 * `related` にまとめる。
 */
export function mergeArticles(
  existing: readonly Article[],
  incoming: readonly Article[],
): Article[] {
  const clusters: Cluster[] = [];
  const byUrl = new Map<string, Cluster>();

  function register(cluster: Cluster, url: string) {
    byUrl.set(urlKey(url), cluster);
  }
  function add(article: Article) {
    const cluster = toCluster(article);
    clusters.push(cluster);
    register(cluster, article.url);
    for (const r of article.related) register(cluster, r.url);
  }

  for (const article of existing) {
    if (!byUrl.has(urlKey(article.url))) add(article);
  }

  const ordered = [...incoming].sort(
    (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
  );
  for (const article of ordered) {
    if (byUrl.has(urlKey(article.url))) continue;
    const candidate = toCluster(article);
    const duplicate = findDuplicate(clusters, candidate);
    if (duplicate === undefined) {
      add(article);
      continue;
    }
    const tags = new Set([...duplicate.article.tags, ...article.tags]);
    duplicate.article = {
      ...duplicate.article,
      tags: TAG_IDS.filter((t) => tags.has(t)),
      related: [...duplicate.article.related, { source: article.source, url: article.url }],
    };
    duplicate.sources.add(article.source);
    register(duplicate, article.url);
  }

  return clusters.map((c) => c.article);
}
