import { CATEGORY_TAGS } from '@itnews/shared';
import type { NewsFile, TagId } from '@itnews/shared';
import { ArticleDayList } from '../components/ArticleDayList';
import { ChipBar } from '../components/ChipBar';
import { UpdatedAt } from '../components/DataStatus';
import { LangSwitch } from '../components/LangSwitch';
import { EmptyView, ErrorView, LoadingView } from '../components/StatusView';
import { Switch } from '../components/Switch';
import { applyArticleFilter, articlesForTab } from '../lib/filter';
import type { NewsTab } from '../lib/filter';
import type { LoadState } from '../lib/useRemoteData';
import type { UserState } from '../lib/userState';

type Props = {
  tab: NewsTab;
  news: LoadState<NewsFile>;
  sourceNames: ReadonlyMap<string, string>;
  selectedTag: TagId | null;
  onSelectTag: (tag: TagId | null) => void;
  onRetry: () => void;
  now: Date;
  user: UserState;
};

export function NewsView({
  tab,
  news,
  sourceNames,
  selectedTag,
  onSelectTag,
  onRetry,
  now,
  user,
}: Props) {
  return (
    <>
      <ChipBar tags={CATEGORY_TAGS[tab]} selected={selectedTag} onSelect={onSelectTag} />
      <div className="toolbar toolbar--news">
        <LangSwitch
          value={user.prefs.langMode}
          onChange={(langMode) => user.updatePrefs((prev) => ({ ...prev, langMode }))}
        />
        <Switch
          checked={user.prefs.unreadOnly}
          onChange={(unreadOnly) => user.updatePrefs((prev) => ({ ...prev, unreadOnly }))}
        >
          未読のみ
        </Switch>
      </div>
      {news.status === 'success' && <UpdatedAt generatedAt={news.data.generatedAt} now={now} />}
      <NewsList
        tab={tab}
        news={news}
        sourceNames={sourceNames}
        selectedTag={selectedTag}
        onRetry={onRetry}
        now={now}
        user={user}
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
  user,
}: Omit<Props, 'onSelectTag'>) {
  if (news.status === 'loading') return <LoadingView label="記事を読み込み中" />;
  if (news.status === 'error') {
    return (
      <ErrorView message="記事を読み込めませんでした" detail={news.message} onRetry={onRetry} />
    );
  }
  const articles = applyArticleFilter(articlesForTab(news.data.articles, tab, selectedTag), {
    ...user.prefs,
    isRead: user.isRead,
  });
  if (articles.length === 0) {
    return <EmptyView message="記事はありません" hint={emptyHint(selectedTag, user)} />;
  }
  return <ArticleDayList articles={articles} sourceNames={sourceNames} now={now} user={user} />;
}

function emptyHint(selectedTag: TagId | null, user: UserState): string | undefined {
  if (user.prefs.unreadOnly) {
    return '未読の記事はありません。「未読のみ」を OFF にすると既読も表示します';
  }
  if (user.prefs.langMode === 'ja') return '「日本語＋英語」にすると英語の記事も表示します';
  if (selectedTag !== null) return '別のサブカテゴリを選んでください';
  return undefined;
}
