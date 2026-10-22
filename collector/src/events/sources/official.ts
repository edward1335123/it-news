import { z } from 'zod';
import type { TechEvent } from '@itnews/shared';
import type { EventCandidate } from '../build';
import { parseEventTime } from '../datetime';
import { detectFormat } from '../location';
import type { GetText, SourceResult } from './types';

/**
 * 主要な展示会・カンファレンスの公式サイト。
 * ページに埋め込まれた schema.org の Event（JSON-LD）だけを読む。HTML の本文は解析しない。
 * events.json では手動管理のイベントと同じ `manual` の情報源として扱い、ID は `manual-official-` で始める。
 */

export type OfficialSite = {
  /** ID の一部にする（小文字英数字とハイフン） */
  id: string;
  name: string;
  /** JSON-LD を含む公式サイトのページ */
  url: string;
  type: TechEvent['type'];
};

/**
 * 登録したサイト（docs/EVENTS.md）。会場が幕張メッセなど東京以外の回は、絞り込みで除かれる。
 * 検証日: 2026-10-23
 */
export const OFFICIAL_SITES: readonly OfficialSite[] = [
  {
    id: 'japan-it-week-spring',
    name: 'Japan IT Week 春',
    url: 'https://www.japan-it.jp/spring/ja-jp.html',
    type: 'expo',
  },
  {
    id: 'japan-it-week-autumn',
    name: 'Japan IT Week 秋',
    url: 'https://www.japan-it.jp/autumn/ja-jp.html',
    type: 'expo',
  },
  {
    id: 'nextech-week-spring',
    name: 'NexTech Week 春',
    url: 'https://www.nextech-week.jp/spring/ja-jp.html',
    type: 'expo',
  },
  {
    id: 'nextech-week-autumn',
    name: 'NexTech Week 秋',
    url: 'https://www.nextech-week.jp/autumn/ja-jp.html',
    type: 'expo',
  },
];

export const OFFICIAL_ID_PREFIX = 'manual-official-';

const LD_JSON =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON-LD のノードを平らにする（配列・`@graph` の中も見る） */
function flatten(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!isObject(value)) return [];
  return [value, ...flatten(value['@graph'])];
}

function isEventNode(node: JsonObject): boolean {
  const types = ([] as unknown[]).concat(node['@type']);
  return types.some((t) => typeof t === 'string' && /Event$/.test(t));
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t === '' ? undefined : t;
}

/** schema.org の PostalAddress か文字列の住所 */
function addressText(value: unknown): string | undefined {
  if (typeof value === 'string') return str(value);
  if (!isObject(value)) return undefined;
  const parts = ['addressRegion', 'addressLocality', 'streetAddress']
    .map((key) => str(value[key]))
    .filter((p) => p !== undefined);
  return parts.length === 0 ? undefined : [...new Set(parts)].join(' ');
}

const placeSchema = z.object({ name: z.unknown(), address: z.unknown() }).partial();

/** HTML に埋め込まれた JSON-LD の Event を取り出す。壊れた JSON は無視する */
export function extractLdEvents(html: string): JsonObject[] {
  const nodes: JsonObject[] = [];
  for (const match of html.matchAll(LD_JSON)) {
    try {
      nodes.push(...flatten(JSON.parse(match[1] ?? '') as unknown));
    } catch {
      // 壊れた JSON-LD は飛ばす
    }
  }
  return nodes.filter(isEventNode);
}

/** 「【公式】NexTech Week 2027 春｜人、企業、…」から「NexTech Week 2027 春」を取り出す */
export function cleanOfficialTitle(name: string): string {
  return name
    .replace(/^【[^】]*公式[^】]*】\s*/, '')
    .split(/[｜|]/)[0]!
    .trim();
}

/** 日付の部分（`2027-04-21`）。ID に使う */
function datePart(startAt: string): string | undefined {
  const ms = parseEventTime(startAt);
  if (ms === undefined) return undefined;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll('-', '');
}

/** JSON-LD の Event を候補にする。中止・延期や、東京・オンラインでないものは null */
export function toCandidate(site: OfficialSite, node: JsonObject): EventCandidate | null {
  const name = str(node.name);
  const startAt = str(node.startDate);
  const date = startAt === undefined ? undefined : datePart(startAt);
  if (name === undefined || startAt === undefined || date === undefined) return null;
  if (/Cancelled|Postponed/i.test(str(node.eventStatus) ?? '')) return null;

  const location = ([] as unknown[]).concat(node.location).find(isObject);
  const place = placeSchema.safeParse(location ?? {}).data ?? {};
  const venue = str(place.name);
  const fullAddress = addressText(place.address);
  // 会場名と同じ文字列の住所は二重に表示されるので省く
  const address = fullAddress === venue ? undefined : fullAddress;
  const title = cleanOfficialTitle(name);

  const mode = str(node.eventAttendanceMode) ?? '';
  let format: TechEvent['format'] | null;
  if (/Online/i.test(mode)) format = 'online';
  else {
    format = detectFormat({ title, venue, address });
    if (/Mixed/i.test(mode) && format === 'offline') format = 'hybrid';
  }
  if (format === null) return null;

  const organizer = isObject(node.organizer) ? str(node.organizer.name) : undefined;
  const url = str(node.url);
  return {
    source: 'manual',
    externalId: `official-${site.id}-${date}`,
    title,
    url: url !== undefined && /^https?:\/\//.test(url) ? url : site.url,
    startAt,
    endAt: str(node.endDate),
    venue,
    address,
    organizer,
    description: str(node.description),
    format,
    type: site.type,
    relevant: true,
  };
}

export async function fetchOfficialSite(input: {
  site: OfficialSite;
  getText: GetText;
}): Promise<SourceResult> {
  const html = await input.getText(input.site.url);
  const nodes = extractLdEvents(html);
  if (nodes.length === 0) throw new Error('ページに Event の JSON-LD がない');
  const candidates = nodes.map((node) => toCandidate(input.site, node)).filter((c) => c !== null);
  return { candidates };
}
