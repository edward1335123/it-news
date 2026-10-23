import type { Article } from '@itnews/shared';
import { useId, useMemo } from 'react';
import { groupArticlesByDay } from '../lib/filter';
import type { UserState } from '../lib/userState';
import { ArticleList } from './ArticleList';

type Props = {
  articles: readonly Article[];
  sourceNames: ReadonlyMap<string, string>;
  now: Date;
  user: UserState;
};

/** 公開日（東京時間）ごとに区切った記事の一覧。日付の見出しはスクロール中も上に固定する */
export function ArticleDayList({ articles, sourceNames, now, user }: Props) {
  const id = useId();
  const groups = useMemo(() => groupArticlesByDay(articles, now), [articles, now]);
  return (
    <div className="days">
      {groups.map((group) => {
        const headingId = `${id}-${group.key}`;
        return (
          <section key={group.key} className="day" aria-labelledby={headingId}>
            <h2 className="day__heading" id={headingId}>
              {group.label}
              <span className="day__count">{group.articles.length}件</span>
            </h2>
            <ArticleList
              articles={group.articles}
              sourceNames={sourceNames}
              now={now}
              user={user}
              titleLevel={3}
            />
          </section>
        );
      })}
    </div>
  );
}
