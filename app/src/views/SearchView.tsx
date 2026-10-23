import type { NewsFile } from '@itnews/shared';
import { useMemo } from 'react';
import { ArticleDayList } from '../components/ArticleDayList';
import { EmptyView, ErrorView, LoadingView } from '../components/StatusView';
import { applyArticleFilter, searchArticles } from '../lib/filter';
import type { LoadState } from '../lib/useRemoteData';
import type { UserState } from '../lib/userState';

type Props = {
  query: string;
  onChangeQuery: (query: string) => void;
  news: LoadState<NewsFile>;
  onRetry: () => void;
  sourceNames: ReadonlyMap<string, string>;
  now: Date;
  user: UserState;
};

export function SearchView({ query, onChangeQuery, news, onRetry, sourceNames, now, user }: Props) {
  return (
    <>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          className="text-input"
          aria-label="キーワード"
          placeholder="キーワード（空白で区切ると AND 検索）"
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          enterKeyHint="search"
          autoFocus
        />
      </form>
      <SearchResults
        query={query}
        news={news}
        onRetry={onRetry}
        sourceNames={sourceNames}
        now={now}
        user={user}
      />
    </>
  );
}

function SearchResults({
  query,
  news,
  onRetry,
  sourceNames,
  now,
  user,
}: Omit<Props, 'onChangeQuery'>) {
  const { langMode, mutedWords, disabledSources } = user.prefs;
  const results = useMemo(() => {
    if (news.status !== 'success') return [];
    // 表示する言語・ミュート語・情報源の OFF は検索結果にも適用する。既読は検索では隠さない
    const visible = applyArticleFilter(news.data.articles, {
      langMode,
      mutedWords,
      disabledSources,
      unreadOnly: false,
      isRead: () => false,
    });
    return searchArticles(visible, query);
  }, [news, query, langMode, mutedWords, disabledSources]);

  if (news.status === 'loading') return <LoadingView label="記事を読み込み中" />;
  if (news.status === 'error') {
    return (
      <ErrorView message="記事を読み込めませんでした" detail={news.message} onRetry={onRetry} />
    );
  }
  if (query.trim() === '') {
    return <EmptyView message="キーワードを入力してください" hint="タイトルと抜粋から探します" />;
  }
  if (results.length === 0) {
    return (
      <EmptyView
        message="一致する記事はありません"
        hint={
          langMode === 'ja'
            ? '「日本語のみ」で表示しています。英語の記事は設定から表示できます'
            : undefined
        }
      />
    );
  }
  return (
    <>
      <p className="result-count" role="status">
        {results.length}件
      </p>
      <ArticleDayList articles={results} sourceNames={sourceNames} now={now} user={user} />
    </>
  );
}
