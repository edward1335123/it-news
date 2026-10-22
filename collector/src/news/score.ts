import type { Article } from '@itnews/shared';

const HOUR = 60 * 60 * 1000;

/** 基本点 */
const BASE = 10;
/** 報道した情報源が1つ増えるごとの加算と、その上限 */
const PER_EXTRA_SOURCE = 20;
const MAX_SOURCE_BONUS = 60;
/** Hacker News のポイントによる加算の上限 */
const MAX_HN_BONUS = 40;
/** 一次情報の加算 */
const PRIMARY_BONUS = 20;
/** 新しさの加算（公開直後が最大で、RECENCY_HOURS で0になる） */
const MAX_RECENCY_BONUS = 30;
const RECENCY_HOURS = 48;

export type ScoreContext = {
  now: number;
  /** 一次情報の情報源か */
  isPrimary: (sourceId: string) => boolean;
  /** 記事（代表とまとめた報道）の URL に付いた Hacker News のポイント。なければ undefined */
  hnPoints: (article: Article) => number | undefined;
};

/** Hacker News のポイントの加算。100点で約35、上限は40 */
export function hnBonus(points: number): number {
  if (points <= 0) return 0;
  return Math.min(MAX_HN_BONUS, Math.round(10 * Math.log2(1 + points / 10)));
}

/**
 * 注目度（SPEC 7章）: 報道した情報源の数、Hacker News のポイント、一次情報かどうか、新しさから算出する。
 * 0以上の整数。収集のたびに計算し直すので、新しさの加算は時間とともに減る。
 */
export function scoreArticle(article: Article, context: ScoreContext): number {
  const sources = new Set([article.source, ...article.related.map((r) => r.source)]);
  const sourceBonus = Math.min(MAX_SOURCE_BONUS, PER_EXTRA_SOURCE * (sources.size - 1));
  const primaryBonus = [...sources].some(context.isPrimary) ? PRIMARY_BONUS : 0;
  const ageHours = Math.max(0, (context.now - Date.parse(article.publishedAt)) / HOUR);
  const recencyBonus = Math.max(0, Math.round(MAX_RECENCY_BONUS * (1 - ageHours / RECENCY_HOURS)));
  const points = context.hnPoints(article);
  return (
    BASE + sourceBonus + primaryBonus + recencyBonus + (points === undefined ? 0 : hnBonus(points))
  );
}
