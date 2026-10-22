import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { decodeEntities } from './text';

/** フィードから取り出した1件。文字列は未加工（HTML・文字参照を含みうる） */
export type FeedItem = {
  title: string;
  url: string;
  /** ISO 8601。日時がないか解釈できなければ undefined */
  publishedAt?: string;
  summary?: string;
  /** Hacker News のポイント */
  points?: number;
};

type XmlNode = Record<string, unknown>;

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function child(node: unknown, name: string): unknown {
  return isNode(node) ? node[name] : undefined;
}

function list(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** 要素の文字列。属性つきの要素（`{ '#text': ... }`）や繰り返しの要素にも対応する */
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (isNode(value)) return text(value['#text']);
  return '';
}

function attr(node: unknown, name: string): string | undefined {
  const value = child(node, `@_${name}`);
  return typeof value === 'string' ? decodeEntities(value) : undefined;
}

/** 候補の要素のうち、最初に空でないものの文字列 */
function firstText(node: unknown, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = text(child(node, name)).trim();
    if (value !== '') return value;
  }
  return undefined;
}

function toIsoDate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

const DATE_FIELDS = ['published', 'pubDate', 'dc:date', 'updated'] as const;
const SUMMARY_FIELDS = ['description', 'summary', 'content:encoded', 'content'] as const;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // 文字参照は自前で戻す（DOCTYPE の実体展開もしない）
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === 'item' || name === 'entry',
});

/** Atom の link 要素から記事の URL を選ぶ（rel="alternate" を優先） */
function atomLink(entry: unknown): string | undefined {
  const links = list(child(entry, 'link'));
  const alternate = links.find((l) => {
    const rel = attr(l, 'rel');
    return rel === undefined || rel === 'alternate';
  });
  const href = attr(alternate ?? links[0], 'href');
  return href ?? (text(alternate).trim() || undefined);
}

function rssLink(item: unknown): string | undefined {
  const link = text(child(item, 'link')).trim();
  if (link !== '') return decodeEntities(link);
  const guid = text(child(item, 'guid')).trim();
  return /^https?:\/\//i.test(guid) ? decodeEntities(guid) : undefined;
}

function toFeedItem(node: unknown, url: string | undefined): FeedItem | undefined {
  const title = firstText(node, ['title']);
  if (title === undefined || url === undefined) return undefined;
  const item: FeedItem = { title, url };
  const publishedAt = toIsoDate(firstText(node, DATE_FIELDS));
  if (publishedAt !== undefined) item.publishedAt = publishedAt;
  const summary = firstText(node, SUMMARY_FIELDS);
  if (summary !== undefined) {
    item.summary = summary;
    // hnrss.org は説明文に「Points: 123」を含む
    const points = /Points:\s*(\d+)/.exec(summary)?.[1];
    if (points !== undefined) item.points = Number(points);
  }
  return item;
}

/** RSS 2.0・RSS 1.0（RDF）・Atom を読む */
export function parseXmlFeed(body: string): FeedItem[] {
  const doc: unknown = parser.parse(body);
  const atom = child(doc, 'feed');
  if (atom !== undefined) {
    return list(child(atom, 'entry')).flatMap((entry) => toFeedItem(entry, atomLink(entry)) ?? []);
  }
  const rss = child(doc, 'rss');
  const rdf = child(doc, 'rdf:RDF');
  if (rss === undefined && rdf === undefined) throw new Error('RSS・Atom として読めない');
  const items = [...list(child(child(rss, 'channel'), 'item')), ...list(child(rdf, 'item'))];
  return items.flatMap((item) => toFeedItem(item, rssLink(item)) ?? []);
}

/** CISA KEV（JSON）の1件。読めない項目は捨てる */
const kevItemSchema = z.object({
  cveID: z.string().regex(/^CVE-\d{4}-\d+$/),
  vulnerabilityName: z.string().min(1),
  dateAdded: z.iso.date(),
  shortDescription: z.string().optional(),
});

const kevSchema = z.object({ vulnerabilities: z.array(z.unknown()) });

/** CISA Known Exploited Vulnerabilities カタログ（JSON）を読む */
export function parseKevFeed(body: string): FeedItem[] {
  const { vulnerabilities } = kevSchema.parse(JSON.parse(body));
  return vulnerabilities.flatMap((value) => {
    const parsed = kevItemSchema.safeParse(value);
    if (!parsed.success) return [];
    const v = parsed.data;
    const item: FeedItem = {
      title: `${v.cveID}: ${v.vulnerabilityName}`,
      url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
      // KEV は日付のみ。米国東部の日付なので、その日の始まり（UTC-5）とする
      publishedAt: new Date(`${v.dateAdded}T00:00:00-05:00`).toISOString(),
    };
    if (v.shortDescription !== undefined) item.summary = v.shortDescription;
    return [item];
  });
}

/** フィードの本文を読む。JSON なら CISA KEV、それ以外は XML とみなす */
export function parseFeed(body: string): FeedItem[] {
  return body.trimStart().startsWith('{') ? parseKevFeed(body) : parseXmlFeed(body);
}
