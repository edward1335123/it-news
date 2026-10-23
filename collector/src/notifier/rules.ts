import { normalizeText } from '@itnews/shared';
import type { Article } from '@itnews/shared';

/** 通知する理由（SPEC 8章の通知条件）。並びは優先度の高い順 */
export type Reason =
  | { kind: 'kev' }
  | { kind: 'jpcert' }
  | { kind: 'cvss'; score: number }
  | { kind: 'keyword'; keyword: string };

/** これ以上の CVSS を通知する */
export const CVSS_THRESHOLD = 9.0;

const KEV_SOURCE = 'cisa-kev';
const JPCERT_SOURCE = 'jpcert';

/** 「CVSS」の直後のこの文字数の中からスコアを探す（「CVSS v4.0で9.2」「CVSS「10.0」」など） */
const CVSS_WINDOW = 24;
/** 版の表記（v3.1、CVSSv4、バージョン3 など）。スコアと取り違えないよう先に除く */
const CVSS_VERSION = /(?:v|version|バージョン)\s*\d+(?:\.\d+)?/gi;
/**
 * スコアの候補。10 以外の整数は日付（12日）などと紛れるので小数だけを拾う。
 * 「9.8/10」の満点側は拾わないよう、直前の「/」も除く
 */
const CVSS_SCORE = /(?<![\d./])(10(?:\.0)?|\d\.\d)(?![\d.])/g;

/**
 * 本文に書かれた CVSS のスコアのうち最大のものを返す。見つからなければ undefined。
 * 記事のデータに CVSS の項目はないので、タイトル・抜粋の「CVSS 9.8」のような表記から読む。
 */
export function findCvssScore(text: string): number | undefined {
  const normalized = text.normalize('NFKC');
  let max: number | undefined;
  for (const match of normalized.matchAll(/cvss/gi)) {
    const start = match.index + match[0].length;
    const window = normalized.slice(start, start + CVSS_WINDOW).replace(CVSS_VERSION, ' ');
    for (const [, value] of window.matchAll(CVSS_SCORE)) {
      const score = Number(value);
      if (score <= 10 && (max === undefined || score > max)) max = score;
    }
  }
  return max;
}

/** 記事が通知条件に当てはまる理由を、優先度の高い順に返す。当てはまらなければ空 */
export function matchReasons(article: Article, keywords: readonly string[]): Reason[] {
  const reasons: Reason[] = [];
  if (article.source === KEV_SOURCE) reasons.push({ kind: 'kev' });
  // JPCERT のフィードには Weekly Report なども入るので、注意喚起だけにする
  if (article.source === JPCERT_SOURCE && article.title.includes('注意喚起')) {
    reasons.push({ kind: 'jpcert' });
  }

  const text = `${article.title}\n${article.summary ?? ''}`;
  const score = findCvssScore(text);
  if (score !== undefined && score >= CVSS_THRESHOLD) reasons.push({ kind: 'cvss', score });

  const normalized = normalizeText(text);
  const keyword = keywords.find((k) => {
    const key = normalizeText(k.trim());
    return key !== '' && normalized.includes(key);
  });
  if (keyword !== undefined) reasons.push({ kind: 'keyword', keyword: keyword.trim() });
  return reasons;
}

const REASON_PRIORITY: Record<Reason['kind'], number> = { kev: 0, jpcert: 1, cvss: 2, keyword: 3 };

export function reasonPriority(reason: Reason): number {
  return REASON_PRIORITY[reason.kind];
}

/** 通知のタイトルに出す理由の表示 */
export function reasonLabel(reason: Reason): string {
  switch (reason.kind) {
    case 'kev':
      return 'CISA KEV に追加';
    case 'jpcert':
      return 'JPCERT 注意喚起';
    case 'cvss':
      return `CVSS ${reason.score.toFixed(1)}`;
    case 'keyword':
      return `注目キーワード「${reason.keyword}」`;
  }
}
