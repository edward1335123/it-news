import type { Article } from '@itnews/shared';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import { TagList } from './TagList';

/** この値以上の注目度を強調して表示する */
export const HOT_SCORE = 80;

type Props = {
  article: Article;
  /** 情報源の表示名。不明なら ID を出す */
  sourceName: string;
  now: Date;
};

export function ArticleCard({ article, sourceName, now }: Props) {
  const relatedCount = article.related.length;
  const hot = article.score >= HOT_SCORE;
  return (
    <article className="card">
      <div className="card__meta">
        <span className="card__source">{sourceName}</span>
        <time dateTime={article.publishedAt} title={formatDateTime(article.publishedAt)}>
          {formatRelativeTime(article.publishedAt, now)}
        </time>
        <span
          className={hot ? 'score score--hot' : 'score'}
          aria-label={`注目度 ${article.score}${hot ? '（注目）' : ''}`}
        >
          {hot ? '注目 ' : ''}
          {article.score}
        </span>
      </div>
      <h2 className="card__title">
        {/* カード全体をタップ領域にする（CSS の ::after で広げる） */}
        <a
          className="card__link"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          lang={article.lang}
        >
          {article.title}
        </a>
      </h2>
      <div className="card__footer">
        <TagList tags={article.tags} />
        {relatedCount > 0 && <span className="card__related">他{relatedCount}件の報道</span>}
      </div>
    </article>
  );
}
