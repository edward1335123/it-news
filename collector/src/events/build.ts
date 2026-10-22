import { eventSchema } from '@itnews/shared';
import type { TechEvent } from '@itnews/shared';
import { titleKey } from '../news/dedupe';
import { toPlainText, truncate } from '../news/text';
import { cleanUrl } from '../news/url';
import { estimateType, eventTags, isRelevant } from './classify';
import { eventEndTime, parseEventTime, toJstIso } from './datetime';
import { detectFormat } from './location';

/** 情報源から取り出したイベント。文字列は未加工（HTML・文字参照を含みうる） */
export type EventCandidate = {
  source: TechEvent['source'];
  /** 情報源の中での ID。TechEvent の id は `<source>-<externalId>` にする */
  externalId: string;
  title: string;
  url: string;
  startAt: string;
  endAt?: string | undefined;
  venue?: string | undefined;
  address?: string | undefined;
  organizer?: string | undefined;
  capacity?: number | undefined;
  accepted?: number | undefined;
  /** 説明文（関連性・タグの判定に使う） */
  description?: string | undefined;
  /** 情報源が付けたカテゴリ・タグ */
  keywords?: readonly string[] | undefined;
  /** 情報源の検索条件で開催形式が分かっているとき（connpass の都道府県の指定など） */
  format?: TechEvent['format'] | undefined;
  /** 種別が分かっているとき（公式サイトの展示会など） */
  type?: TechEvent['type'] | undefined;
  /** IT 関連であることが分かっているとき（関連性の判定を省く） */
  relevant?: boolean | undefined;
};

/** 関連性・タグの判定に使う本文の長さ（後半の宣伝文・会社紹介に出る語で誤判定しないよう、先頭だけを見る） */
const BODY_LENGTH = 200;

function optionalText(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const text = toPlainText(raw);
  return text === '' ? undefined : text;
}

function count(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/**
 * 候補を TechEvent にする。東京・オンラインでないもの、IT 関連でないもの、
 * 日時・URL が正しくないものは null。
 */
export function toEvent(candidate: EventCandidate): TechEvent | null {
  const title = toPlainText(candidate.title);
  const url = cleanUrl(candidate.url);
  const start = parseEventTime(candidate.startAt);
  if (title === '' || url === null || start === undefined) return null;

  const venue = optionalText(candidate.venue);
  const address = optionalText(candidate.address);
  const format = candidate.format ?? detectFormat({ title, venue, address });
  if (format === null) return null;

  const body =
    candidate.description === undefined
      ? undefined
      : truncate(toPlainText(candidate.description), BODY_LENGTH);
  const text = { title, body, keywords: candidate.keywords };
  if (candidate.relevant !== true && !isRelevant(text)) return null;

  const end = parseEventTime(candidate.endAt);
  const capacity = count(candidate.capacity);
  const accepted = count(candidate.accepted);
  const organizer = optionalText(candidate.organizer);
  const event: TechEvent = {
    id: `${candidate.source}-${candidate.externalId}`,
    title,
    url,
    source: candidate.source,
    type: candidate.type ?? estimateType({ title, capacity }),
    format,
    startAt: toJstIso(start),
    ...(end !== undefined && end >= start ? { endAt: toJstIso(end) } : {}),
    // オンラインのみのイベントの会場（「オンライン」など）は表示しない
    ...(venue !== undefined && format !== 'online' ? { venue } : {}),
    ...(address !== undefined && format !== 'online' ? { address } : {}),
    ...(organizer === undefined ? {} : { organizer }),
    ...(capacity === undefined || capacity === 0 ? {} : { capacity }),
    ...(accepted === undefined ? {} : { accepted }),
    tags: eventTags(text),
  };
  return eventSchema.safeParse(event).success ? event : null;
}

/** 同じイベントが複数の情報源にあるとき、先に残す情報源の順 */
const SOURCE_PRIORITY: readonly TechEvent['source'][] = [
  'manual',
  'connpass',
  'doorkeeper',
  'techplay',
];

/** 同じイベントとみなすキー（タイトルと開始日時が同じ） */
function sameEventKey(event: TechEvent): string {
  return `${titleKey(event.title)}@${Date.parse(event.startAt)}`;
}

/**
 * 前回の events.json と今回の取得結果から、新しいイベント一覧を作る（開催日が近い順）。
 *
 * - 終了したイベントは除く（SPEC 7章: 保持はイベントの終了まで）
 * - 今回取得したイベントは前回の内容を置き換える。取得できなかったイベントは前回の内容を残す
 *   （TECH PLAY の RSS は新着50件しかなく、取得に失敗する情報源もあるため）
 * - `removedIds`（中止になったイベントなど）と、`dropPrevious` に当てはまる前回のイベント
 *   （手動管理のファイルのように、毎回すべてを読み直す情報源）は前回から引き継がない
 * - タイトルと開始日時が同じイベントは、SOURCE_PRIORITY の順で1件にまとめる
 */
export function buildEvents(input: {
  previous: readonly TechEvent[];
  incoming: readonly TechEvent[];
  removedIds?: ReadonlySet<string>;
  dropPrevious?: (event: TechEvent) => boolean;
  now: number;
}): TechEvent[] {
  const { previous, incoming, now } = input;
  const removed = input.removedIds ?? new Set<string>();
  const dropPrevious = input.dropPrevious ?? (() => false);

  const byId = new Map<string, TechEvent>();
  for (const event of previous) {
    if (removed.has(event.id) || dropPrevious(event)) continue;
    byId.set(event.id, event);
  }
  for (const event of incoming) {
    if (!removed.has(event.id)) byId.set(event.id, event);
  }

  const rank = (e: TechEvent) => SOURCE_PRIORITY.indexOf(e.source);
  const candidates = [...byId.values()]
    .filter((e) => eventEndTime(e) > now)
    .sort((a, b) => rank(a) - rank(b));
  const seen = new Set<string>();
  const events: TechEvent[] = [];
  for (const event of candidates) {
    const key = sameEventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }
  return events.sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id),
  );
}
