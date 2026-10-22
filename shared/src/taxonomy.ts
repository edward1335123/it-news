/** SPEC 4章のカテゴリ・タグ・イベント種別の定義。 */

export type Definition = {
  readonly label: string;
  /** 表示用のアクセント色（#rrggbb） */
  readonly color: string;
};

export const CATEGORY_IDS = ['ai', 'security', 'general'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORIES = {
  ai: { label: 'AI', color: '#7c3aed' },
  security: { label: 'セキュリティ', color: '#dc2626' },
  general: { label: 'IT全般', color: '#475569' },
} as const satisfies Record<CategoryId, Definition>;

export const TAG_IDS = [
  'ai-dev',
  'ai-agent',
  'ai-model',
  'ai-oss',
  'ai-multimodal',
  'ai-research',
  'ai-business',
  'ai-policy',
  'ai-security',
  'ai-infra',
  'sec-vuln',
  'sec-incident',
  'sec-malware',
  'sec-advisory',
  'sec-cloud',
] as const;
export type TagId = (typeof TAG_IDS)[number];

export const TAGS = {
  'ai-dev': { label: 'AI駆動開発', color: '#2563eb' },
  'ai-agent': { label: 'AIエージェント', color: '#0891b2' },
  'ai-model': { label: 'モデル・LLM', color: '#7c3aed' },
  'ai-oss': { label: 'ローカルLLM/OSS', color: '#059669' },
  'ai-multimodal': { label: 'マルチモーダル', color: '#db2777' },
  'ai-research': { label: '研究・論文', color: '#4f46e5' },
  'ai-business': { label: 'ビジネス・事例', color: '#d97706' },
  'ai-policy': { label: '規制・政策', color: '#65a30d' },
  'ai-security': { label: 'AIセキュリティ', color: '#c026d3' },
  'ai-infra': { label: 'インフラ・GPU', color: '#0d9488' },
  'sec-vuln': { label: '脆弱性・CVE', color: '#dc2626' },
  'sec-incident': { label: 'インシデント・侵害', color: '#ea580c' },
  'sec-malware': { label: 'マルウェア・ランサムウェア', color: '#b91c1c' },
  'sec-advisory': { label: '注意喚起', color: '#ca8a04' },
  'sec-cloud': { label: 'クラウド・ID', color: '#0284c7' },
} as const satisfies Record<TagId, Definition>;

/**
 * タブごとのサブカテゴリ（チップの表示順）。
 * `ai-security` は AI とセキュリティの両方に表示する。
 */
export const CATEGORY_TAGS = {
  ai: [
    'ai-dev',
    'ai-agent',
    'ai-model',
    'ai-oss',
    'ai-multimodal',
    'ai-research',
    'ai-business',
    'ai-policy',
    'ai-security',
    'ai-infra',
  ],
  security: ['sec-vuln', 'sec-incident', 'sec-malware', 'sec-advisory', 'sec-cloud', 'ai-security'],
} as const satisfies Record<'ai' | 'security', readonly TagId[]>;

export const EVENT_TYPE_IDS = ['expo', 'conference', 'meetup'] as const;
export type EventTypeId = (typeof EVENT_TYPE_IDS)[number];

export const EVENT_TYPES = {
  expo: { label: '展示会', color: '#d97706' },
  conference: { label: 'カンファレンス', color: '#7c3aed' },
  meetup: { label: '勉強会', color: '#059669' },
} as const satisfies Record<EventTypeId, Definition>;

export const EVENT_FORMAT_IDS = ['offline', 'online', 'hybrid'] as const;
export type EventFormatId = (typeof EVENT_FORMAT_IDS)[number];

export const EVENT_FORMATS = {
  offline: { label: '東京', color: '#475569' },
  online: { label: 'オンライン', color: '#2563eb' },
  hybrid: { label: 'ハイブリッド', color: '#0d9488' },
} as const satisfies Record<EventFormatId, Definition>;

export const EVENT_SOURCE_IDS = ['connpass', 'doorkeeper', 'techplay', 'manual'] as const;
export type EventSourceId = (typeof EVENT_SOURCE_IDS)[number];

export const EVENT_SOURCES = {
  connpass: { label: 'connpass' },
  doorkeeper: { label: 'Doorkeeper' },
  techplay: { label: 'TECH PLAY' },
  manual: { label: '手動登録' },
} as const satisfies Record<EventSourceId, { readonly label: string }>;
