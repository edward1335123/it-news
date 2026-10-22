import { eventsFileSchema, newsFileSchema, sourcesFileSchema } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import { useMemo, useState } from 'react';
import { Header } from './components/Header';
import { EmptyView } from './components/StatusView';
import { TabBar } from './components/TabBar';
import { TABS, tabId, tabPanelId } from './tabs';
import type { TabId } from './tabs';
import type { NewsTab } from './lib/filter';
import { dataUrl, useRemoteData } from './lib/useRemoteData';
import { EventsView } from './views/EventsView';
import { NewsView } from './views/NewsView';

const parseNews = (input: unknown) => newsFileSchema.parse(input);
const parseEvents = (input: unknown) => eventsFileSchema.parse(input);
const parseSources = (input: unknown) => sourcesFileSchema.parse(input);

/** ヘッダーから開く画面 */
type Overlay = 'search' | 'settings';

const OVERLAYS: Record<Overlay, { title: string; message: string }> = {
  search: { title: '検索', message: 'キーワード検索は準備中です' },
  settings: { title: '設定', message: '設定項目は準備中です' },
};

export function App() {
  const [tab, setTab] = useState<TabId>('ai');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [selectedTags, setSelectedTags] = useState<Record<NewsTab, TagId | null>>({
    ai: null,
    security: null,
  });
  // 相対時刻の基準。読み込み時点で固定する
  const [now] = useState(() => new Date());

  const news = useRemoteData(dataUrl('news.json'), parseNews);
  const events = useRemoteData(dataUrl('events.json'), parseEvents);
  // 情報源の名前が取れなくても記事は表示する（ID で代用する）
  const { state: sources } = useRemoteData(dataUrl('sources.json'), parseSources);
  const sourceNames = useMemo(
    () =>
      new Map(sources.status === 'success' ? sources.data.sources.map((s) => [s.id, s.name]) : []),
    [sources],
  );

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
        <Header title={OVERLAYS[overlay].title} onBack={() => setOverlay(null)} />
      )}
      {overlay === null ? (
        <main className="main" role="tabpanel" id={tabPanelId(tab)} aria-labelledby={tabId(tab)}>
          {(tab === 'ai' || tab === 'security') && (
            <NewsView
              tab={tab}
              news={news.state}
              sourceNames={sourceNames}
              selectedTag={selectedTags[tab]}
              onSelectTag={(tag) => setSelectedTags((prev) => ({ ...prev, [tab]: tag }))}
              onRetry={news.reload}
              now={now}
            />
          )}
          {tab === 'events' && <EventsView events={events.state} onRetry={events.reload} />}
          {tab === 'saved' && (
            <EmptyView
              message="保存した記事はありません"
              hint="お気に入り・後で読むに追加した記事がここに表示されます"
            />
          )}
        </main>
      ) : (
        <main className="main">
          <EmptyView message={OVERLAYS[overlay].message} />
        </main>
      )}
      <TabBar current={tab} onChange={changeTab} />
    </div>
  );
}
