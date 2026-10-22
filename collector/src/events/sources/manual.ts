import { z } from 'zod';
import { eventSchema } from '@itnews/shared';
import type { TechEvent } from '@itnews/shared';
import { OFFICIAL_ID_PREFIX } from './official';

/**
 * 手動で管理する展示会・カンファレンス（`data/manual-events.json`）。
 * 各イベントは events.json の TechEvent から `source` を除いた形で書く（`source` は `manual` になる）。
 * ID は `manual-` で始める。不正なイベントは理由を返して飛ばし、他のイベントは読み込む。
 */

export const MANUAL_ID_PREFIX = 'manual-';

const fileSchema = z.object({ events: z.array(z.unknown()) });

export type ManualParseResult = { events: TechEvent[]; errors: string[] };

export function parseManualEvents(json: unknown): ManualParseResult {
  const file = fileSchema.safeParse(json);
  if (!file.success) {
    return { events: [], errors: [`形式が正しくない: ${file.error.message}`] };
  }

  const events: TechEvent[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  file.data.events.forEach((entry, index) => {
    const parsed = eventSchema.strict().safeParse({ ...(entry as object), source: 'manual' });
    if (!parsed.success) {
      errors.push(`${index + 1}件目: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
      return;
    }
    const { id } = parsed.data;
    if (!id.startsWith(MANUAL_ID_PREFIX) || id.startsWith(OFFICIAL_ID_PREFIX)) {
      errors.push(
        `${id}: ID は "${MANUAL_ID_PREFIX}" で始める（"${OFFICIAL_ID_PREFIX}" は使えない）`,
      );
      return;
    }
    if (ids.has(id)) {
      errors.push(`${id}: ID が重複している`);
      return;
    }
    ids.add(id);
    events.push(parsed.data);
  });
  return { events, errors };
}

/** 手動管理のファイルから読んだイベントか（公式サイトから取得したものを除く） */
export function isManualFileEvent(event: TechEvent): boolean {
  return event.id.startsWith(MANUAL_ID_PREFIX) && !event.id.startsWith(OFFICIAL_ID_PREFIX);
}
