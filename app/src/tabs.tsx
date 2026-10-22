import type { ReactNode } from 'react';
import { BookmarkIcon, CalendarIcon, ShieldIcon, SparkIcon } from './components/icons';

/** 下部のタブバーのタブ（SPEC 3章） */
export const TAB_IDS = ['ai', 'security', 'events', 'saved'] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TABS: Record<TabId, { label: string; icon: ReactNode }> = {
  ai: { label: 'AI', icon: <SparkIcon /> },
  security: { label: 'セキュリティ', icon: <ShieldIcon /> },
  events: { label: 'イベント', icon: <CalendarIcon /> },
  saved: { label: '保存', icon: <BookmarkIcon /> },
};

export function tabId(tab: TabId): string {
  return `tab-${tab}`;
}

export function tabPanelId(tab: TabId): string {
  return `panel-${tab}`;
}
