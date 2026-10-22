import { XMLParser } from 'fast-xml-parser';
import type { EventCandidate } from '../build';
import type { GetText, SourceResult } from './types';

/**
 * TECH PLAY のイベント RSS（新着順に50件）。
 * 開催日時・会場は独自の要素（`tp:eventStartTime` など。日本時間でタイムゾーンなし）に入っている。
 * 新着しか載らないので、過去に取得したイベントは events.json に残して終了まで表示する。
 */

export const TECHPLAY_FEED = 'https://rss.techplay.jp/event/w3c-rss-format/rss.xml';

type XmlNode = Record<string, unknown>;

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (isNode(value)) return text(value['#text']);
  return '';
}

function optional(value: unknown): string | undefined {
  const t = text(value);
  return t === '' ? undefined : t;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  // 文字参照は toEvent で戻す（DOCTYPE の実体展開もしない）
  processEntities: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === 'item' || name === 'category',
});

/** RSS の文字列からイベントの候補を取り出す。RSS でなければ例外を投げる */
export function parseTechplayFeed(xml: string): EventCandidate[] {
  const doc: unknown = parser.parse(xml);
  const channel = isNode(doc) && isNode(doc.rss) ? doc.rss.channel : undefined;
  if (!isNode(channel)) throw new Error('TECH PLAY の RSS ではない');
  const items = Array.isArray(channel.item) ? channel.item : [];

  const candidates: EventCandidate[] = [];
  for (const item of items) {
    if (!isNode(item)) continue;
    const url = text(item.link);
    const id = /\/event\/(\d+)/.exec(url)?.[1];
    const startAt = optional(item['tp:eventStartTime']);
    if (id === undefined || startAt === undefined) continue;
    const categories = Array.isArray(item.category) ? item.category.map(text) : [];
    candidates.push({
      source: 'techplay',
      externalId: id,
      title: text(item.title),
      url,
      startAt,
      endAt: optional(item['tp:eventEndTime']),
      venue: optional(item['tp:eventPlace']),
      address: optional(item['tp:eventAddress']),
      description: optional(item.description),
      keywords: categories.filter((c) => c !== ''),
    });
  }
  return candidates;
}

export async function fetchTechplay(input: { getText: GetText }): Promise<SourceResult> {
  return { candidates: parseTechplayFeed(await input.getText(TECHPLAY_FEED)) };
}
