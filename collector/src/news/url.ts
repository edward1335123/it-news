import { createHash } from 'node:crypto';
import { z } from 'zod';

/** 計測用で、記事の同一性に関係しないクエリパラメータ */
const TRACKING_PARAM =
  /^(utm_\w+|fbclid|gclid|yclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|igshid|ref|ref_src)$/i;

/** news.json のスキーマ（shared の `z.httpUrl()`）と同じ判定。IP アドレスや `_` を含むホストなどは通らない */
const webUrl = z.httpUrl();

/**
 * 記事の URL を整える。http/https 以外や解釈できない URL、スキーマに通らない URL は null。
 * フラグメント・認証情報・計測用パラメータを除き、残りのパラメータを並べ替える。
 */
export function cleanUrl(raw: string, base?: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  url.username = '';
  url.password = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return webUrl.safeParse(url.href).success ? url.href : null;
}

/**
 * 重複判定用の正規化 URL。http/https・`www.` の有無・末尾のスラッシュの違いを同じとみなす。
 * `cleanUrl` を通した URL を渡す。
 */
export function urlKey(cleaned: string): string {
  const url = new URL(cleaned);
  const host = url.hostname.replace(/^www\./, '');
  const port = url.port === '' ? '' : `:${url.port}`;
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  return `${host}${port}${path}${url.search}`;
}

/** 記事 ID（正規化 URL の SHA-256 の先頭16桁） */
export function articleId(cleaned: string): string {
  return createHash('sha256').update(urlKey(cleaned)).digest('hex').slice(0, 16);
}
