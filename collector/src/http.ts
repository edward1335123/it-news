import type { HttpGet } from './news/fetcher';

/** robots.txt の User-agent と照合する製品トークン */
export const PRODUCT_TOKEN = 'itnews-pwa-collector';
export const USER_AGENT = `${PRODUCT_TOKEN}/0.1 (personal news reader; RSS/Atom)`;
/** 1回の取得の制限時間 */
const TIMEOUT_MS = 20_000;
/** 応答の最大サイズ（CISA KEV の JSON が約1.5MB） */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const DEFAULT_ACCEPT =
  'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.8, */*;q=0.5';

/** 応答は UTF-8 として読む（登録した情報源はすべて UTF-8 で配信している） */
export const httpGet: HttpGet = async (url, headers = {}) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: DEFAULT_ACCEPT, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error(`応答が大きすぎる（${length} bytes）`);
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    body: await res.text(),
  };
};
