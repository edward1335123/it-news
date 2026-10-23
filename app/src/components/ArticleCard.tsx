import type { Article } from '@itnews/shared';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import { SAVED_LIST_LABELS } from '../lib/userState';
import type { SavedList } from '../lib/userState';
import { ClockIcon, StarIcon } from './icons';
import { TagList } from './TagList';

/** この値以上の注目度の記事に「注目」バッジを付ける */
export const HOT_SCORE = 80;
/** カードに表示するタグの数の上限（SPEC 3.1） */
export const CARD_MAX_TAGS = 2;

type Props = {
  article: Article;
  /** 情報源の表示名。不明なら ID を出す */
  sourceName: string;
  now: Date;
  read: boolean;
  saved: Record<SavedList, boolean>;
  /** 記事を開いたとき（既読にする） */
  onOpen: () => void;
  onToggleSaved: (list: SavedList) => void;
  /** タイトルの見出しレベル。既定は 2 */
  titleLevel?: 2 | 3 | undefined;
};

export function ArticleCard({
  article,
  sourceName,
  now,
  read,
  saved,
  onOpen,
  onToggleSaved,
  titleLevel = 2,
}: Props) {
  const relatedCount = article.related.length;
  const hot = article.score >= HOT_SCORE;
  const Title = titleLevel === 3 ? 'h3' : 'h2';
  return (
    <article className={read ? 'card card--read' : 'card'}>
      <div className="card__meta">
        <span className="card__source">{sourceName}</span>
        <time dateTime={article.publishedAt} title={formatDateTime(article.publishedAt)}>
          {formatRelativeTime(article.publishedAt, now)}
        </time>
        {read && <span className="card__read">既読</span>}
        {article.lang === 'en' && (
          <span className="lang-label" title="英語の記事">
            EN
          </span>
        )}
        {hot && <span className="hot-badge">注目</span>}
      </div>
      <Title className="card__title">
        {/* カード全体をタップ領域にする（CSS の ::after で広げる） */}
        <a
          className="card__link"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          lang={article.lang}
          onClick={onOpen}
          // 中クリックで開いたときだけ既読にする（右クリックのメニューでは既読にしない）
          onAuxClick={(e) => {
            if (e.button === 1) onOpen();
          }}
        >
          {article.title}
        </a>
      </Title>
      <div className="card__footer">
        <TagList tags={article.tags} max={CARD_MAX_TAGS} />
        {relatedCount > 0 && <span className="card__related">他{relatedCount}件の報道</span>}
        <div className="card__actions">
          <button
            type="button"
            className="icon-button toggle-button toggle-button--favorite"
            aria-label={SAVED_LIST_LABELS.favorite}
            aria-pressed={saved.favorite}
            onClick={() => onToggleSaved('favorite')}
          >
            <StarIcon />
          </button>
          <button
            type="button"
            className="icon-button toggle-button"
            aria-label={SAVED_LIST_LABELS.later}
            aria-pressed={saved.later}
            onClick={() => onToggleSaved('later')}
          >
            <ClockIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
