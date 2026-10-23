import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { newsFileSchema } from '@itnews/shared';
import { DATA_DIR, consoleLogger as log, readJson, writeAtomically } from '../io';
import { runNotifier } from './notify';
import { EMPTY_STATE, notifyStateSchema } from './plan';
import type { NotifyState } from './plan';
import { createSender, readNotifierEnv } from './send';

/** 送信済みの記録。git には含めず、Actions のキャッシュで次回に引き継ぐ */
export const STATE_PATH = resolve(import.meta.dirname, '../../.state/notify-state.json');
const NEWS_PATH = join(DATA_DIR, 'news.json');

/** 送信済みの記録。なければ空、壊れていれば警告して空にする */
async function readState(): Promise<NotifyState> {
  try {
    const json = await readJson(STATE_PATH);
    if (json === undefined) return EMPTY_STATE;
    const parsed = notifyStateSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    log.warn('[notify] 送信済みの記録の形式が正しくないため使わない');
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    log.warn('[notify] 送信済みの記録が JSON として正しくないため使わない');
  }
  return EMPTY_STATE;
}

async function main(): Promise<void> {
  const env = readNotifierEnv(process.env);
  if (env.kind === 'skip') {
    log.info(`[notify] ${env.missing.join('・')} が未設定のため通知しない`);
    return;
  }
  if (env.kind === 'invalid') {
    log.error(`[notify] ${env.message}`);
    process.exitCode = 1;
    return;
  }

  const news = newsFileSchema.parse(await readJson(NEWS_PATH));
  const result = await runNotifier({
    articles: news.articles,
    state: await readState(),
    config: env.config,
    send: createSender(env.vapid),
    now: Date.now(),
    log,
  });

  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeAtomically(STATE_PATH, `${JSON.stringify(result.state)}\n`);
  if (result.failed) process.exitCode = 1;
}

await main();
