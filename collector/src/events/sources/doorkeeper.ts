import { z } from 'zod';
import type { EventCandidate } from '../build';
import type { GetJson, SourceResult } from './types';

/**
 * Doorkeeper API（https://www.doorkeeper.jp/developer/api）の注目イベント一覧。
 * 都道府県で絞るとオンライン開催（住所なし）が入らないので、全国を取得して collector で絞り込む。
 */

export const DOORKEEPER_ENDPOINT = 'https://api.doorkeeper.jp/events';
/** 1ページの件数（API の仕様） */
const PAGE_SIZE = 25;
/** 取得するページ数の上限（API の制限は5分に300リクエスト） */
export const DOORKEEPER_MAX_PAGES = 20;
/** 今日から何日先までを検索するか */
const DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

const doorkeeperEventSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullish(),
  venue_name: z.string().nullish(),
  address: z.string().nullish(),
  ticket_limit: z.number().nullish(),
  participants: z.number().nullish(),
  description: z.string().nullish(),
  public_url: z.string(),
  group: z.union([z.object({ name: z.string().nullish() }), z.number()]).nullish(),
});
export type DoorkeeperEvent = z.infer<typeof doorkeeperEventSchema>;

const responseSchema = z.array(z.object({ event: z.unknown() }));

/** 日本時間の日付（`yyyy-mm-dd`） */
function jstDate(ms: number): string {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function pageUrl(now: number, page: number): string {
  const params = new URLSearchParams({
    sort: 'starts_at',
    since: jstDate(now),
    until: jstDate(now + DAYS * DAY),
    locale: 'ja',
    'expand[]': 'group',
    page: String(page),
  });
  return `${DOORKEEPER_ENDPOINT}?${params.toString()}`;
}

function undef<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function toCandidate(event: DoorkeeperEvent): EventCandidate {
  return {
    source: 'doorkeeper',
    externalId: String(event.id),
    title: event.title,
    url: event.public_url,
    startAt: event.starts_at,
    endAt: undef(event.ends_at),
    venue: undef(event.venue_name),
    address: undef(event.address),
    organizer:
      typeof event.group === 'object' && event.group !== null ? undef(event.group.name) : undefined,
    capacity: undef(event.ticket_limit),
    accepted: undef(event.participants),
    description: undef(event.description),
  };
}

export async function fetchDoorkeeper(input: {
  getJson: GetJson;
  now: number;
}): Promise<SourceResult> {
  const candidates: EventCandidate[] = [];
  for (let page = 1; page <= DOORKEEPER_MAX_PAGES; page += 1) {
    const items = responseSchema.parse(await input.getJson(pageUrl(input.now, page)));
    for (const item of items) {
      const parsed = doorkeeperEventSchema.safeParse(item.event);
      if (parsed.success) candidates.push(toCandidate(parsed.data));
    }
    if (items.length < PAGE_SIZE) break;
  }
  return { candidates };
}
