import { z } from 'zod';
import type { EventCandidate } from '../build';
import { detectFormat } from '../location';
import type { GetJson, SourceResult } from './types';

/**
 * connpass API v2（https://connpass.com/about/api/v2/）。
 * API キーを `X-API-Key` に付けて呼ぶ。制限は1秒に1リクエストまで。
 * 東京と「オンライン」の都道府県を別々に検索し、両方に出たイベントはハイブリッドとする。
 */

export const CONNPASS_ENDPOINT = 'https://connpass.com/api/v2/events/';
/** 1回の検索で取得する件数（API の上限） */
const PAGE_SIZE = 100;
/** 都道府県ごとに取得するページ数の上限 */
export const CONNPASS_MAX_PAGES = 10;
/** 今月から何か月分を検索するか */
const MONTHS = 3;

const PREFECTURES = ['tokyo', 'online'] as const;
type Prefecture = (typeof PREFECTURES)[number];

const connpassEventSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  catch: z.string().nullish(),
  description: z.string().nullish(),
  url: z.string(),
  started_at: z.string().nullish(),
  ended_at: z.string().nullish(),
  limit: z.number().nullish(),
  open_status: z.string().nullish(),
  group: z.object({ title: z.string().nullish() }).nullish(),
  address: z.string().nullish(),
  place: z.string().nullish(),
  owner_display_name: z.string().nullish(),
  accepted: z.number().nullish(),
});
export type ConnpassEvent = z.infer<typeof connpassEventSchema>;

const responseSchema = z.object({
  results_available: z.number().int(),
  results_returned: z.number().int(),
  events: z.array(z.unknown()),
});

/** 日本時間の今月から `MONTHS` か月分の `yyyymm` */
export function searchMonths(now: number): string[] {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  return Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function searchUrl(
  prefecture: Prefecture,
  months: readonly string[],
  start: number,
): string {
  const params = new URLSearchParams({ prefecture, order: '2', count: String(PAGE_SIZE) });
  for (const ym of months) params.append('ym', ym);
  params.set('start', String(start));
  return `${CONNPASS_ENDPOINT}?${params.toString()}`;
}

function undef<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/** 検索で見つかった都道府県と会場から開催形式を決める */
function formatOf(event: ConnpassEvent, found: ReadonlySet<Prefecture>): EventCandidate['format'] {
  if (found.has('tokyo') && found.has('online')) return 'hybrid';
  if (!found.has('tokyo')) return 'online';
  const detected = detectFormat({
    title: event.title,
    venue: undef(event.place),
    address: undef(event.address),
  });
  return detected === 'hybrid' ? 'hybrid' : 'offline';
}

export function toCandidate(
  event: ConnpassEvent,
  found: ReadonlySet<Prefecture>,
): EventCandidate | null {
  if (event.started_at === null || event.started_at === undefined) return null;
  return {
    source: 'connpass',
    externalId: String(event.id),
    title: event.title,
    url: event.url,
    startAt: event.started_at,
    endAt: undef(event.ended_at),
    venue: undef(event.place),
    address: undef(event.address),
    organizer: undef(event.group?.title) ?? undef(event.owner_display_name),
    capacity: undef(event.limit),
    accepted: undef(event.accepted),
    description: [event.catch ?? '', event.description ?? ''].join('\n'),
    format: formatOf(event, found),
  };
}

/** connpass のイベントを取得する。中止のイベントは removedIds に入れる */
export async function fetchConnpass(input: {
  apiKey: string;
  getJson: GetJson;
  now: number;
}): Promise<SourceResult> {
  const { apiKey, getJson, now } = input;
  const months = searchMonths(now);
  const events = new Map<number, { event: ConnpassEvent; found: Set<Prefecture> }>();

  for (const prefecture of PREFECTURES) {
    let start = 1;
    for (let page = 0; page < CONNPASS_MAX_PAGES; page += 1) {
      const res = responseSchema.parse(
        await getJson(searchUrl(prefecture, months, start), { 'X-API-Key': apiKey }),
      );
      for (const raw of res.events) {
        const parsed = connpassEventSchema.safeParse(raw);
        if (!parsed.success) continue;
        const entry = events.get(parsed.data.id) ?? {
          event: parsed.data,
          found: new Set<Prefecture>(),
        };
        entry.found.add(prefecture);
        events.set(parsed.data.id, entry);
      }
      start += res.results_returned;
      if (res.results_returned === 0 || start > res.results_available) break;
    }
  }

  const candidates: EventCandidate[] = [];
  const removedIds: string[] = [];
  for (const { event, found } of events.values()) {
    if (event.open_status === 'cancelled') {
      removedIds.push(`connpass-${event.id}`);
      continue;
    }
    const candidate = toCandidate(event, found);
    if (candidate !== null) candidates.push(candidate);
  }
  return { candidates, removedIds };
}
