import { CATEGORY_TAGS, normalizeText } from '@itnews/shared';
import type { Article, TagId, TechEvent } from '@itnews/shared';
import { formatDayLabel, tokyoDateKey } from './format';

/** サブカテゴリのチップで絞り込むニュースのタブ */
export type NewsTab = keyof typeof CATEGORY_TAGS;

/**
 * タブに表示する記事を新しい順に返す。
 * タブのサブカテゴリのタグを1つ以上持つ記事を表示するので、`ai-security` は両方のタブに出る。
 * `tag` を指定するとそのサブカテゴリだけに絞り込む。
 */
export function articlesForTab(
  articles: readonly Article[],
  tab: NewsTab,
  tag: TagId | null,
): Article[] {
  const tabTags: readonly TagId[] = CATEGORY_TAGS[tab];
  return sortArticles(
    articles.filter((a) =>
      tag === null ? a.tags.some((t) => tabTags.includes(t)) : a.tags.includes(tag),
    ),
  );
}

/** 記事を新しい順に返す */
export function sortArticles(articles: readonly Article[]): Article[] {
  return [...articles].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** 比較用に文字列を正規化する（notifier の注目キーワードと同じ規則にするため shared に置く） */
export { normalizeText };

/** 記事の検索対象（タイトルと抜粋） */
function articleText(article: Article): string {
  return normalizeText(`${article.title}\n${article.summary ?? ''}`);
}

/** 空白で区切った語に分ける */
function splitWords(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .filter((w) => w !== '');
}

/**
 * キーワード検索。空白で区切った語をすべてタイトルか抜粋に含む記事を返す（AND 検索）。
 * 語がなければ空の配列を返す。
 */
export function searchArticles(articles: readonly Article[], query: string): Article[] {
  const words = splitWords(query);
  if (words.length === 0) return [];
  return sortArticles(
    articles.filter((a) => {
      const text = articleText(a);
      return words.every((w) => text.includes(w));
    }),
  );
}

/** 表示する言語（SPEC 3.1）。`all` は日本語＋英語 */
export const LANG_MODES = ['all', 'ja'] as const;
export type LangMode = (typeof LANG_MODES)[number];

export const LANG_MODE_LABELS: Record<LangMode, string> = {
  all: '日本語＋英語',
  ja: '日本語のみ',
};

export type ArticleFilter = {
  /** `ja` なら英語の記事を隠す */
  langMode: LangMode;
  /** タイトル・抜粋にどれかを含む記事を隠す */
  mutedWords: readonly string[];
  /** OFF にした情報源の ID */
  disabledSources: readonly string[];
  /** true なら既読の記事を隠す */
  unreadOnly: boolean;
  isRead: (id: string) => boolean;
};

/** 表示する言語・ミュート語・情報源の ON/OFF・未読のみ表示を適用する */
export function applyArticleFilter(articles: readonly Article[], filter: ArticleFilter): Article[] {
  const muted = filter.mutedWords.map(normalizeText).filter((w) => w.trim() !== '');
  const disabled = new Set(filter.disabledSources);
  return articles.filter((a) => {
    if (filter.langMode === 'ja' && a.lang !== 'ja') return false;
    if (disabled.has(a.source)) return false;
    if (filter.unreadOnly && filter.isRead(a.id)) return false;
    if (muted.length > 0) {
      const text = articleText(a);
      if (muted.some((w) => text.includes(w))) return false;
    }
    return true;
  });
}

export type DayGroup = {
  /** 東京時間の日付（2026-10-22 の形式） */
  key: string;
  /** 見出し（今日 / 昨日 / 10月21日（火）） */
  label: string;
  /** 今日（東京時間）の区切りか */
  today: boolean;
  articles: Article[];
};

/**
 * 記事を公開日（東京時間）ごとに分ける。日付・記事の順番は渡した順のまま。
 * `now` より後の日付の記事（0:00 をまたいで再取得したときや、端末の時計の遅れ）は今日にまとめる。
 */
export function groupArticlesByDay(articles: readonly Article[], now: Date): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  const todayKey = tokyoDateKey(now.toISOString());
  for (const article of articles) {
    const articleKey = tokyoDateKey(article.publishedAt);
    // キーは 2026-10-22 の形式なので、文字列の比較で日付の前後が分かる
    const key = articleKey > todayKey ? todayKey : articleKey;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        key,
        label: key === todayKey ? '今日' : formatDayLabel(article.publishedAt, now),
        today: key === todayKey,
        articles: [article],
      });
    } else {
      group.articles.push(article);
    }
  }
  return [...groups.values()];
}

/** イベントを開催日が近い順に返す */
export function sortEvents(events: readonly TechEvent[]): TechEvent[] {
  return [...events].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

const DAY = 24 * 60 * 60 * 1000;
/** 東京の UTC からのずれ（夏時間はない） */
const TOKYO_OFFSET = 9 * 60 * 60 * 1000;

/**
 * イベントが終わる時刻（epoch ミリ秒）。
 * 終了日時がなければ、開始日の終わり（東京の 24:00）まで開催中とみなす。
 */
export function eventEndTime(event: TechEvent): number {
  if (event.endAt !== undefined) return Date.parse(event.endAt);
  const local = Date.parse(event.startAt) + TOKYO_OFFSET;
  return Math.floor(local / DAY) * DAY + DAY - TOKYO_OFFSET;
}

export type EventFilter = {
  /** null は「すべて」 */
  type: TechEvent['type'] | null;
  format: TechEvent['format'] | null;
};

/** 終了したイベントを除き、種別・形式で絞り込んで開催日が近い順に返す */
export function filterEvents(
  events: readonly TechEvent[],
  filter: EventFilter,
  now: Date,
): TechEvent[] {
  const nowTime = now.getTime();
  return sortEvents(
    events.filter(
      (e) =>
        eventEndTime(e) > nowTime &&
        (filter.type === null || e.type === filter.type) &&
        (filter.format === null || e.format === filter.format),
    ),
  );
}
