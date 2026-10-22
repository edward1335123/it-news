import type { EventCandidate } from '../build';

/** 1つの情報源の取得結果 */
export type SourceResult = {
  candidates: EventCandidate[];
  /** 中止になったなどで、前回の events.json から消すイベントの ID */
  removedIds?: string[];
};

/** API を呼ぶ。応答の JSON を返し、2xx 以外は例外を投げる */
export type GetJson = (url: string, headers?: Readonly<Record<string, string>>) => Promise<unknown>;

/** 情報源のフィード・ページを robots.txt を守って取得する */
export type GetText = (url: string) => Promise<string>;
