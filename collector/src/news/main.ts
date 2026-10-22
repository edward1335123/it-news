import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { newsFileSchema, sourcesFileSchema } from '@itnews/shared';
import type { Article } from '@itnews/shared';
import { collectNews } from './collect';
import type { Logger } from './collect';
import { createPoliteFetcher } from './fetcher';
import type { HttpGet } from './fetcher';

/** robots.txt の User-agent と照合する製品トークン */
export const PRODUCT_TOKEN = 'itnews-pwa-collector';
export const USER_AGENT = `${PRODUCT_TOKEN}/0.1 (personal news reader; RSS/Atom)`;
/** 1回の取得の制限時間 */
const TIMEOUT_MS = 20_000;
/** 同じホストへ続けてアクセスするときの間隔 */
const HOST_INTERVAL_MS = 2_000;
/** 応答の最大サイズ（CISA KEV の JSON が約1.5MB） */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const DATA_DIR = resolve(import.meta.dirname, '../../../app/public/data');
const SOURCES_PATH = join(DATA_DIR, 'sources.json');
const NEWS_PATH = join(DATA_DIR, 'news.json');

/** 応答は UTF-8 として読む（登録した情報源はすべて UTF-8 で配信している） */
const httpGet: HttpGet = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.8, */*;q=0.5',
    },
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

const log: Logger = {
  info: (message) => console.info(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** 前回の news.json。なければ空、形式が違えば警告して空にする */
async function readPrevious(): Promise<Article[]> {
  const json = await readJson(NEWS_PATH);
  if (json === undefined) return [];
  const parsed = newsFileSchema.safeParse(json);
  if (parsed.success) return parsed.data.articles;
  log.warn(`[news] 前回の news.json の形式が正しくないため使わない: ${parsed.error.message}`);
  return [];
}

/**
 * 書き込み途中のファイルを配信しないよう、一時ファイルに書いてから置き換える。
 * Windows では置き換え先を他のプロセス（開発サーバーなど）が開いていると rename が
 * EPERM・EACCES・EBUSY になるので、そのときは上書きコピーする。
 */
async function writeAtomically(path: string, content: string): Promise<void> {
  const temp = `${path}.tmp`;
  await writeFile(temp, content, 'utf8');
  try {
    await rename(temp, path);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw error;
    await copyFile(temp, path);
    await rm(temp, { force: true });
  }
}

async function main(): Promise<void> {
  const { sources } = sourcesFileSchema.parse(await readJson(SOURCES_PATH));
  const previous = await readPrevious();
  const now = Date.now();

  const fetchFeed = createPoliteFetcher({
    get: httpGet,
    productToken: PRODUCT_TOKEN,
    intervalMs: HOST_INTERVAL_MS,
  });
  const { articles, failures } = await collectNews({ sources, previous, fetchFeed, now, log });

  if (failures.length === sources.length) {
    log.error('[news] すべての情報源の取得に失敗したため、news.json を更新しない');
    process.exitCode = 1;
    return;
  }

  const file = newsFileSchema.parse({ generatedAt: new Date(now).toISOString(), articles });
  await writeAtomically(NEWS_PATH, `${JSON.stringify(file)}\n`);

  log.info(
    `[news] news.json に ${articles.length}件を出力（取得失敗 ${failures.length}/${sources.length}）`,
  );
  if (failures.length > 0) {
    log.warn(`[news] 失敗した情報源: ${failures.map((f) => f.sourceId).join(', ')}`);
  }
}

await main();
