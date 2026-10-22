import type { TagId, TechEvent } from '@itnews/shared';
import {
  classify,
  compileKeywords,
  isAiText,
  isSecurityText,
  normalizeForMatch,
} from '../news/classify';
import type { Keyword } from '../news/keywords';

/**
 * イベントの関連性の判定（IT・AI・セキュリティ）と、種別・タグの推定。
 * タグと AI・セキュリティの判定は、ニュースのキーワード辞書（SPEC 4章）を使う。
 */

/** IT 関連のイベントであることを示す語（AI・セキュリティ以外） */
const IT_WORDS: readonly Keyword[] = [
  'エンジニア',
  'engineer',
  'engineers',
  'engineering',
  'エンジニアリング',
  'プログラミング',
  'programming',
  'プログラマ',
  'developer',
  'developers',
  '開発者',
  'ソフトウェア',
  'software',
  'web開発',
  'webアプリ',
  'webエンジニア',
  'アプリ開発',
  'システム開発',
  'クラウド',
  'cloud',
  'aws',
  'azure',
  'gcp',
  'google cloud',
  'kubernetes',
  'k8s',
  'docker',
  'コンテナ',
  'devops',
  'sre',
  'インフラ',
  'ネットワーク',
  'データ分析',
  'データ基盤',
  'データエンジニア',
  'データサイエンス',
  'データベース',
  'database',
  'sql',
  'python',
  'javascript',
  'typescript',
  'node.js',
  'react',
  'vue',
  'next.js',
  'golang',
  'go言語',
  'rust',
  'java',
  'kotlin',
  'swift',
  'flutter',
  'php',
  'ruby',
  'rails',
  'scala',
  'c#',
  '.net',
  'linux',
  'oss',
  'オープンソース',
  'open source',
  'github',
  'api',
  'フロントエンド',
  'バックエンド',
  'frontend',
  'backend',
  'モバイルアプリ',
  'ios',
  'android',
  'アジャイル',
  'agile',
  'スクラム',
  'scrum',
  'iot',
  'ハッカソン',
  'hackathon',
  'もくもく会',
  'lt会',
  'テックトーク',
  'tech',
  'テック',
  'dx',
  'saas',
  'ノーコード',
  'ローコード',
  'cto',
  'テスト自動化',
  'ブロックチェーン',
  'blockchain',
  'web3',
  'ゲーム開発',
  'unity',
  'unreal engine',
  '情報システム',
  '情シス',
  'cms',
  'wordpress',
];
const isItText = compileKeywords(IT_WORDS);

export type EventText = {
  title: string;
  /** 説明文などの本文（プレーンテキスト） */
  body?: string | undefined;
  /** 情報源が付けたカテゴリ・タグ */
  keywords?: readonly string[] | undefined;
};

function matchText({ title, body, keywords }: EventText): string {
  return normalizeForMatch([title, body ?? '', ...(keywords ?? [])].join('\n'));
}

/** IT・AI・セキュリティに関連するイベントか */
export function isRelevant(event: EventText): boolean {
  const text = matchText(event);
  return isAiText(text) || isSecurityText(text) || isItText(text) || eventTags(event).length > 0;
}

/** SPEC 4.1/4.2 のタグ。タイトル・本文・情報源のカテゴリをキーワード辞書で判定する */
export function eventTags(event: EventText): TagId[] {
  const summary = [event.body ?? '', ...(event.keywords ?? [])].join(' ');
  return classify({ title: event.title, summary }, { defaultCategory: 'general' }, {}).tags;
}

/** 大型展示会を示す語 */
const EXPO_WORDS =
  /展示会|見本市|総合展|博覧会|(?<![a-z])expo(?![a-z])|エキスポ|エクスポ|\bfair\b|トレードショー|trade ?show|\b(?:it|dx|tech|nextech) week\b/i;
/** カンファレンスを示す語 */
const CONFERENCE_WORDS =
  /カンファレンス|コンファレンス|conference|summit|サミット|フォーラム|forum|シンポジウム|symposium|kaigi|\bdays?\b|\b\w*conf\b|\b(?:py|js|go|php|ruby|java|rust|swift|dev|sec|code|hack)con\b|devfest|フェス(?:ティバル)?|festival|大会|tech ?fest/i;
/** 定員がこの人数以上ならカンファレンスとみなす */
export const CONFERENCE_CAPACITY = 500;

/**
 * 種別を推定する（SPEC 4.3）。
 * タイトルに展示会の語があれば expo、カンファレンスの語があるか定員が大きければ conference、
 * それ以外（勉強会・ミートアップ・セミナー）は meetup。
 */
export function estimateType(event: {
  title: string;
  capacity?: number | undefined;
}): TechEvent['type'] {
  const title = event.title.normalize('NFKC');
  if (EXPO_WORDS.test(title)) return 'expo';
  if (CONFERENCE_WORDS.test(title)) return 'conference';
  if (event.capacity !== undefined && event.capacity >= CONFERENCE_CAPACITY) return 'conference';
  return 'meetup';
}
