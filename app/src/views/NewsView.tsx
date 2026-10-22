import { CATEGORY_TAGS } from '@itnews/shared';
import type { NewsFile, TagId } from '@itnews/shared';
import { ArticleCard } from '../components/ArticleCard';
import { ChipBar } from '../components/ChipBar';
import { EmptyView, ErrorView, LoadingView } from '../components/StatusView';
import { articlesForTab } from '../lib/filter';
import type { NewsTab } from '../lib/filter';
import type { LoadState } from '../lib/useRemoteData';

type Props = {
  tab: NewsTab;
  news: LoadState<NewsFile>;
  sourceNames: ReadonlyMap<string, string>;
  selectedTag: TagId | null;
  onSelectTag: (tag: TagId | null) => void;
  onRetry: () => void;
  now: Date;
};

export function NewsView({
  tab,
  news,
  sourceNames,
  selectedTag,
  onSelectTag,
  onRetry,
  now,
}: Props) {
  return (
    <>
      <ChipBar tags={CATEGORY_TAGS[tab]} selected={selectedTag} onSelect={onSelectTag} />
      <NewsList
        tab={tab}
        news={news}
        sourceNames={sourceNames}
        selectedTag={selectedTag}
        onRetry={onRetry}
        now={now}
      />
    </>
  );
}

function NewsList({
  tab,
  news,
  sourceNames,
  selectedTag,
  onRetry,
  now,
}: Omit<Props, 'onSelectTag'>) {
  if (news.status === 'loading') return <LoadingView label="記事を読み込み中" />;
  if (news.status === 'error') {
    return (
      <ErrorView message="記事を読み込めませんでした" detail={news.message} onRetry={onRetry} />
    );
  }
  const articles = articlesForTab(news.data.articles, tab, selectedTag);
  if (articles.length === 0) {
    return (
      <EmptyView
        message="記事はありません"
        hint={selectedTag === null ? undefined : '別のサブカテゴリを選んでください'}
      />
    );
  }
  return (
    <ul className="list">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard
            article={article}
            sourceName={sourceNames.get(article.source) ?? article.source}
            now={now}
          />
        </li>
      ))}
    </ul>
  );
}
