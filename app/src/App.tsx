import { eventsFileSchema, newsFileSchema, sourcesFileSchema } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import { useMemo, useState } from 'react';
import { OfflineBanner } from './components/DataStatus';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { TABS, tabId, tabPanelId } from './tabs';
import type { TabId } from './tabs';
import type { EventFilter, NewsTab } from './lib/filter';
import { useNow } from './lib/useNow';
import { useOnline } from './lib/useOnline';
import { dataUrl, useRemoteData } from './lib/useRemoteData';
import { useUserState } from './lib/userState';
import type { SavedList } from './lib/userState';
import { EventsView } from './views/EventsView';
import { NewsView } from './views/NewsView';
import { SavedView } from './views/SavedView';
import { SearchView } from './views/SearchView';
import { SettingsView } from './views/SettingsView';

const parseNews = (input: unknown) => newsFileSchema.parse(input);
const parseEvents = (input: unknown) => eventsFileSchema.parse(input);
const parseSources = (input: unknown) => sourcesFileSchema.parse(input);

/** ヘッダーから開く画面 */
type Overlay = 'search' | 'settings';

const OVERLAY_TITLES: Record<Overlay, string> = {
  search: '検索',
  settings: '設定',
};

export function App() {
  const [tab, setTab] = useState<TabId>('ai');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [selectedTags, setSelectedTags] = useState<Record<NewsTab, TagId | null>>({
    ai: null,
    security: null,
  });
  const [eventFilter, setEventFilter] = useState<EventFilter>({ type: null, format: null });
  const [savedList, setSavedList] = useState<SavedList>('favorite');
  const [query, setQuery] = useState('');
  const now = useNow();
  const online = useOnline();
  const user = useUserState();

  const news = useRemoteData(dataUrl('news.json'), parseNews);
  const events = useRemoteData(dataUrl('events.json'), parseEvents);
  // 情報源の名前が取れなくても記事は表示する（ID で代用する）
  const sources = useRemoteData(dataUrl('sources.json'), parseSources);
  const sourceNames = useMemo(
    () =>
      new Map(
        sources.state.status === 'success'
          ? sources.state.data.sources.map((s) => [s.id, s.name])
          : [],
      ),
    [sources.state],
  );

  // 表示中の画面が使うデータ。保存タブ・検索は記事のデータを使う
  const visibleData =
    overlay === 'settings' ? sources : overlay === null && tab === 'events' ? events : news;

  const changeTab = (next: TabId) => {
    setOverlay(null);
    setTab(next);
  };

  return (
    <div className="app">
      {overlay === null ? (
        <Header
          title={TABS[tab].label}
          onSearch={() => setOverlay('search')}
          onSettings={() => setOverlay('settings')}
        />
      ) : (
        <Header title={OVERLAY_TITLES[overlay]} onBack={() => setOverlay(null)} />
      )}
      <main className="main">
        {!online && <OfflineBanner hasData={visibleData.state.status === 'success'} />}
        {overlay === null && (
          <div role="tabpanel" id={tabPanelId(tab)} aria-labelledby={tabId(tab)}>
            {(tab === 'ai' || tab === 'security') && (
              <NewsView
                tab={tab}
                news={news.state}
                sourceNames={sourceNames}
                selectedTag={selectedTags[tab]}
                onSelectTag={(tag) => setSelectedTags((prev) => ({ ...prev, [tab]: tag }))}
                onRetry={news.reload}
                now={now}
                user={user}
              />
            )}
            {tab === 'events' && (
              <EventsView
                events={events.state}
                onRetry={events.reload}
                filter={eventFilter}
                onChangeFilter={setEventFilter}
                now={now}
              />
            )}
            {tab === 'saved' && (
              <SavedView
                list={savedList}
                onChangeList={setSavedList}
                news={news.state}
                sourceNames={sourceNames}
                now={now}
                user={user}
              />
            )}
          </div>
        )}
        {overlay === 'search' && (
          <SearchView
            query={query}
            onChangeQuery={setQuery}
            news={news.state}
            onRetry={news.reload}
            sourceNames={sourceNames}
            now={now}
            user={user}
          />
        )}
        {overlay === 'settings' && (
          <SettingsView sources={sources.state} onRetrySources={sources.reload} user={user} />
        )}
      </main>
      <TabBar current={tab} onChange={changeTab} panelVisible={overlay === null} />
    </div>
  );
}
