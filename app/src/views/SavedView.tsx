import type { Article, NewsFile } from '@itnews/shared';
import { useMemo } from 'react';
import { ArticleList } from '../components/ArticleList';
import { FilterChips } from '../components/FilterChips';
import { EmptyView } from '../components/StatusView';
import type { LoadState } from '../lib/useRemoteData';
import { SAVED_LIST_LABELS, SAVED_LISTS } from '../lib/userState';
import type { SavedList, UserState } from '../lib/userState';

type Props = {
  list: SavedList;
  onChangeList: (list: SavedList) => void;
  /** 最新の記事。保存したときより報道件数などが増えていればこちらを表示する */
  news: LoadState<NewsFile>;
  sourceNames: ReadonlyMap<string, string>;
  now: Date;
  user: UserState;
};

const EMPTY_HINTS: Record<SavedList, string> = {
  favorite: '記事カードの星のボタンで追加できます',
  later: '記事カードの時計のボタンで追加できます',
};

export function SavedView({ list, onChangeList, news, sourceNames, now, user }: Props) {
  const latest = useMemo(
    () =>
      new Map<string, Article>(
        news.status === 'success' ? news.data.articles.map((a) => [a.id, a]) : [],
      ),
    [news],
  );
  const articles = user.saved[list].map((item) => latest.get(item.article.id) ?? item.article);
  const options = SAVED_LISTS.map((id) => ({
    id,
    label: `${SAVED_LIST_LABELS[id]} ${user.saved[id].length}`,
  }));

  return (
    <>
      {/* 「すべて」は選ばせないので、null が来たら無視する */}
      <FilterChips
        label="保存の種類"
        options={options}
        selected={list}
        onSelect={(next) => {
          if (next !== null) onChangeList(next);
        }}
        showAll={false}
      />
      {articles.length === 0 ? (
        <EmptyView message={`${SAVED_LIST_LABELS[list]}はありません`} hint={EMPTY_HINTS[list]} />
      ) : (
        <ArticleList articles={articles} sourceNames={sourceNames} now={now} user={user} />
      )}
    </>
  );
}
