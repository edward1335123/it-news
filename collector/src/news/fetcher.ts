import { ALLOW_ALL, isAllowed, parseRobots } from './robots';
import type { RobotsRules } from './robots';

export type HttpResponse = { status: number; contentType: string; body: string };
/** URL を GET する。通信できなければ例外を投げる */
export type HttpGet = (
  url: string,
  headers?: Readonly<Record<string, string>>,
) => Promise<HttpResponse>;

export type Sleep = (ms: number) => Promise<void>;

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ホストごとに処理を1つずつ実行し、前の処理が終わってから `intervalMs` あけて次を始める。
 * 別のホストへの処理は並行して進む。
 */
export function createHostQueue(intervalMs: number, wait: Sleep = sleep) {
  const tails = new Map<string, Promise<void>>();
  return function enqueue<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(host);
    const result = (
      previous === undefined ? Promise.resolve() : previous.then(() => wait(intervalMs))
    ).then(task);
    tails.set(
      host,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  };
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

/** robots.txt の応答を規則にする。5xx は取得できない（全て禁止とみなす）ので例外にする */
function robotsFromResponse(res: HttpResponse, productToken: string): RobotsRules {
  if (res.status >= 500) throw new Error(`robots.txt を取得できない（HTTP ${res.status}）`);
  // 404 や、robots.txt の代わりに HTML を返すサイトは制限なしとみなす
  if (!isOk(res.status) || /html/i.test(res.contentType) || res.body.trimStart().startsWith('<')) {
    return ALLOW_ALL;
  }
  return parseRobots(res.body, productToken);
}

export type PoliteFetcherOptions = {
  get: HttpGet;
  /** robots.txt の User-agent と照合する製品トークン */
  productToken: string;
  /** 同じホストへ続けてアクセスするときの間隔 */
  intervalMs: number;
  wait?: Sleep;
};

/**
 * SPEC 7章の収集ルールを守って取得する。
 * robots.txt で禁止されたURLは取得せず、同じホストへの連続アクセスは間隔をあける。
 */
export function createPoliteFetcher({ get, productToken, intervalMs, wait }: PoliteFetcherOptions) {
  const enqueue = createHostQueue(intervalMs, wait);
  const robotsCache = new Map<string, Promise<RobotsRules>>();

  function robotsFor(url: URL): Promise<RobotsRules> {
    let rules = robotsCache.get(url.origin);
    if (rules === undefined) {
      rules = enqueue(url.host, () => get(`${url.origin}/robots.txt`)).then((res) =>
        robotsFromResponse(res, productToken),
      );
      robotsCache.set(url.origin, rules);
    }
    return rules;
  }

  return async function fetchFeed(feedUrl: string): Promise<string> {
    const url = new URL(feedUrl);
    const rules = await robotsFor(url);
    if (!isAllowed(rules, `${url.pathname}${url.search}`)) {
      throw new Error('robots.txt で禁止されている');
    }
    const res = await enqueue(url.host, () => get(feedUrl));
    if (!isOk(res.status)) throw new Error(`HTTP ${res.status}`);
    return res.body;
  };
}
