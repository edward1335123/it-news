import type { Article } from '@itnews/shared';
import { isSaved } from '../lib/userState';
import type { UserState } from '../lib/userState';
import { ArticleCard } from './ArticleCard';

type Props = {
  articles: readonly Article[];
  sourceNames: ReadonlyMap<string, string>;
  now: Date;
  user: UserState;
  /** 記事のタイトルの見出しレベル。日付の見出しの下に置くときは 3 にする */
  titleLevel?: 2 | 3 | undefined;
};

/** 既読・保存の状態を反映した記事カードの一覧 */
export function ArticleList({ articles, sourceNames, now, user, titleLevel }: Props) {
  return (
    <ul className="list">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard
            article={article}
            sourceName={sourceNames.get(article.source) ?? article.source}
            now={now}
            titleLevel={titleLevel}
            read={user.isRead(article.id)}
            saved={{
              favorite: isSaved(user.saved, 'favorite', article.id),
              later: isSaved(user.saved, 'later', article.id),
            }}
            onOpen={() => user.markRead(article.id)}
            onToggleSaved={(list) => user.toggleSaved(list, article)}
          />
        </li>
      ))}
    </ul>
  );
}
