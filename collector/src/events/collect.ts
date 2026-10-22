import type { TechEvent } from '@itnews/shared';
import { errorMessage } from '../io';
import type { Logger } from '../io';
import { buildEvents, toEvent } from './build';
import { isManualFileEvent } from './sources/manual';
import type { SourceResult } from './sources/types';

/** 取得する情報源。`skip` があれば取得せず、理由をログに残す */
export type EventSourceTask =
  { id: string; run: () => Promise<SourceResult> } | { id: string; skip: string };

export type EventFailure = { sourceId: string; error: string };

/**
 * すべての情報源からイベントを取得し、前回の events.json・手動管理のイベントと合わせて一覧を作る。
 * 取得に失敗した情報源はログに残して飛ばし、他の情報源の処理は続ける（前回のイベントは残る）。
 */
export async function collectEvents(input: {
  tasks: readonly EventSourceTask[];
  manual: readonly TechEvent[];
  previous: readonly TechEvent[];
  now: number;
  log: Logger;
}): Promise<{ events: TechEvent[]; failures: EventFailure[]; attempted: number }> {
  const { tasks, manual, previous, now, log } = input;
  const incoming: TechEvent[] = [...manual];
  const removedIds = new Set<string>();
  const failures: EventFailure[] = [];
  let attempted = 0;

  const results = await Promise.all(
    tasks.map(async (task) => {
      if ('skip' in task) {
        log.info(`[events] ${task.id}: スキップ（${task.skip}）`);
        return null;
      }
      attempted += 1;
      try {
        return { id: task.id, result: await task.run() };
      } catch (error) {
        const message = errorMessage(error);
        log.error(`[events] ${task.id}: 取得に失敗: ${message}`);
        failures.push({ sourceId: task.id, error: message });
        return null;
      }
    }),
  );

  for (const entry of results) {
    if (entry === null) continue;
    const { id, result } = entry;
    const events = result.candidates.map(toEvent).filter((e) => e !== null);
    for (const removed of result.removedIds ?? []) removedIds.add(removed);
    log.info(`[events] ${id}: ${result.candidates.length}件中 ${events.length}件を取り込む`);
    incoming.push(...events);
  }

  const events = buildEvents({
    previous,
    incoming,
    removedIds,
    // 手動管理のファイルは毎回すべて読み直すので、消したイベントを前回から引き継がない
    dropPrevious: isManualFileEvent,
    now,
  });
  return { events, failures, attempted };
}
