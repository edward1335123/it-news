import type { TagId } from '@itnews/shared';

/**
 * 情報源ごとの収集の設定。sources.json（SPEC 5章の Source）にない、collector だけが使う情報。
 */
export type SourceProfile = {
  /** 一次情報（公式の発表・研究ブログ）。注目度を加算する */
  primary?: boolean;
  /** 常に付けるタグ */
  alwaysTags?: readonly TagId[];
  /** AI・セキュリティの記事で、タブのタグが1つも付かなかったときのタグ */
  fallbackTag?: TagId;
  /** 1回の取得で取り込む件数（新しい順） */
  maxItems?: number;
  /** false なら抜粋を保存しない（説明文が定型文のフィード） */
  summary?: boolean;
  /** キーワードでタグが付かない記事を捨てる（件数が多く、関係ない記事も多いフィード） */
  requireKeywordTag?: boolean;
};

/** 論文フィードは1日に数百件あるので、取り込む件数を絞る */
const ARXIV_MAX_ITEMS = 30;

export const SOURCE_PROFILES: Readonly<Partial<Record<string, SourceProfile>>> = {
  openai: { primary: true, fallbackTag: 'ai-model' },
  'google-ai': { primary: true, fallbackTag: 'ai-model' },
  'google-deepmind': { primary: true, fallbackTag: 'ai-research' },
  'google-research': { primary: true, fallbackTag: 'ai-research' },
  'microsoft-ai': { primary: true },
  'microsoft-research': { primary: true, fallbackTag: 'ai-research' },
  'aws-ml': { primary: true, fallbackTag: 'ai-infra' },
  'nvidia-blog': { primary: true, fallbackTag: 'ai-infra' },
  'nvidia-developer': { primary: true, fallbackTag: 'ai-infra' },
  mistral: { primary: true, fallbackTag: 'ai-model' },
  'hugging-face': { primary: true, fallbackTag: 'ai-oss' },
  'github-blog': { primary: true, fallbackTag: 'ai-dev' },
  'simon-willison': { fallbackTag: 'ai-model' },
  'latent-space': { fallbackTag: 'ai-model' },
  // 説明文は「Article URL / Comments URL / Points」の定型文なので保存しない
  'hacker-news': { summary: false },
  jpcert: { primary: true, alwaysTags: ['sec-advisory'] },
  ipa: { primary: true, alwaysTags: ['sec-advisory'] },
  'cisa-kev': { primary: true, alwaysTags: ['sec-vuln', 'sec-advisory'] },
  'project-zero': { primary: true, fallbackTag: 'sec-vuln' },
  unit42: { primary: true, fallbackTag: 'sec-malware' },
  trendmicro: { primary: true, fallbackTag: 'sec-malware' },
  lac: { primary: true },
  'arxiv-cs-ai': { alwaysTags: ['ai-research'], maxItems: ARXIV_MAX_ITEMS },
  'arxiv-cs-cl': { alwaysTags: ['ai-research'], maxItems: ARXIV_MAX_ITEMS },
  'arxiv-cs-cr': { requireKeywordTag: true, maxItems: ARXIV_MAX_ITEMS },
};

export function profileOf(sourceId: string): SourceProfile {
  return SOURCE_PROFILES[sourceId] ?? {};
}
