import { join, resolve } from 'node:path';
import { eventsFileSchema } from '@itnews/shared';
import type { TechEvent } from '@itnews/shared';
import { PRODUCT_TOKEN, httpGet } from '../http';
import { DATA_DIR, consoleLogger as log, readJson, writeAtomically } from '../io';
import { createHostQueue, createPoliteFetcher } from '../news/fetcher';
import { collectEvents } from './collect';
import type { EventSourceTask } from './collect';
import { fetchConnpass } from './sources/connpass';
import { fetchDoorkeeper } from './sources/doorkeeper';
import { parseManualEvents } from './sources/manual';
import { OFFICIAL_SITES, fetchOfficialSite } from './sources/official';
import { fetchTechplay } from './sources/techplay';
import type { GetJson } from './sources/types';

/** 同じホストへ続けてアクセスするときの間隔（RSS・公式サイト） */
const HOST_INTERVAL_MS = 2_000;
/** API を続けて呼ぶときの間隔（connpass の制限は1秒に1リクエスト） */
const API_INTERVAL_MS = 1_100;

const EVENTS_PATH = join(DATA_DIR, 'events.json');
const MANUAL_PATH = resolve(import.meta.dirname, '../../../data/manual-events.json');

/** 前回の events.json。なければ空、形式が違えば警告して空にする */
async function readPrevious(): Promise<TechEvent[]> {
  const json = await readJson(EVENTS_PATH);
  if (json === undefined) return [];
  const parsed = eventsFileSchema.safeParse(json);
  if (parsed.success) return parsed.data.events;
  log.warn(`[events] 前回の events.json の形式が正しくないため使わない: ${parsed.error.message}`);
  return [];
}

async function readManual(): Promise<TechEvent[]> {
  const json = await readJson(MANUAL_PATH);
  if (json === undefined) {
    log.warn('[events] data/manual-events.json がない');
    return [];
  }
  const { events, errors } = parseManualEvents(json);
  for (const error of errors) log.warn(`[events] manual-events.json: ${error}`);
  log.info(`[events] manual: ${events.length}件`);
  return events;
}

/**
 * 公式の API を呼ぶ。API は利用規約と API の制限に従って使う。
 * connpass・Doorkeeper の robots.txt は API の URL も含めて全体を禁止しているが、
 * これはクローラー向けの指定で、API の利用は各サービスが案内している正規の方法なので確認しない。
 */
function createApiClient(): GetJson {
  const enqueue = createHostQueue(API_INTERVAL_MS);
  return async (url, headers = {}) => {
    const res = await enqueue(new URL(url).host, () =>
      httpGet(url, { Accept: 'application/json', ...headers }),
    );
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(res.body) as unknown;
  };
}

async function main(): Promise<void> {
  const now = Date.now();
  const [previous, manual] = await Promise.all([readPrevious(), readManual()]);

  const getJson = createApiClient();
  const getText = createPoliteFetcher({
    get: httpGet,
    productToken: PRODUCT_TOKEN,
    intervalMs: HOST_INTERVAL_MS,
  });
  const apiKey = process.env.CONNPASS_API_KEY?.trim() ?? '';

  const tasks: EventSourceTask[] = [
    apiKey === ''
      ? { id: 'connpass', skip: '環境変数 CONNPASS_API_KEY が未設定' }
      : { id: 'connpass', run: () => fetchConnpass({ apiKey, getJson, now }) },
    { id: 'doorkeeper', run: () => fetchDoorkeeper({ getJson, now }) },
    { id: 'techplay', run: () => fetchTechplay({ getText }) },
    ...OFFICIAL_SITES.map((site) => ({
      id: `official:${site.id}`,
      run: () => fetchOfficialSite({ site, getText }),
    })),
  ];

  const { events, failures, attempted } = await collectEvents({
    tasks,
    manual,
    previous,
    now,
    log,
  });

  if (attempted > 0 && failures.length === attempted) {
    log.error('[events] すべての情報源の取得に失敗したため、events.json を更新しない');
    process.exitCode = 1;
    return;
  }

  const file = eventsFileSchema.parse({ generatedAt: new Date(now).toISOString(), events });
  await writeAtomically(EVENTS_PATH, `${JSON.stringify(file)}\n`);

  log.info(
    `[events] events.json に ${events.length}件を出力（取得失敗 ${failures.length}/${attempted}）`,
  );
  if (failures.length > 0) {
    log.warn(`[events] 失敗した情報源: ${failures.map((f) => f.sourceId).join(', ')}`);
  }
}

await main();
