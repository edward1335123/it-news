import { join } from 'node:path';
import { newsFileSchema, sourcesFileSchema } from '@itnews/shared';
import type { Article } from '@itnews/shared';
import { PRODUCT_TOKEN, httpGet } from '../http';
import { DATA_DIR, consoleLogger as log, readJson, writeAtomically } from '../io';
import { collectNews } from './collect';
import { createPoliteFetcher } from './fetcher';

/** 同じホストへ続けてアクセスするときの間隔 */
const HOST_INTERVAL_MS = 2_000;

const SOURCES_PATH = join(DATA_DIR, 'sources.json');
const NEWS_PATH = join(DATA_DIR, 'news.json');

/** 前回の news.json。なければ空、形式が違えば警告して空にする */
async function readPrevious(): Promise<Article[]> {
  const json = await readJson(NEWS_PATH);
  if (json === undefined) return [];
  const parsed = newsFileSchema.safeParse(json);
  if (parsed.success) return parsed.data.articles;
  log.warn(`[news] 前回の news.json の形式が正しくないため使わない: ${parsed.error.message}`);
  return [];
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
