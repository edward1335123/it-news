import type { KeyboardEvent } from 'react';
import { TAB_IDS, TABS, tabId, tabPanelId } from '../tabs';
import type { TabId } from '../tabs';

type Props = {
  current: TabId;
  onChange: (tab: TabId) => void;
  /** 選択中のタブのパネルを表示しているか（検索・設定を開いている間は false） */
  panelVisible: boolean;
};

/** 矢印キー・Home・End で移る先のタブ */
function nextTab(current: TabId, key: string): TabId | undefined {
  const index = TAB_IDS.indexOf(current);
  const last = TAB_IDS.length - 1;
  switch (key) {
    case 'ArrowRight':
      return TAB_IDS[index === last ? 0 : index + 1];
    case 'ArrowLeft':
      return TAB_IDS[index === 0 ? last : index - 1];
    case 'Home':
      return TAB_IDS[0];
    case 'End':
      return TAB_IDS[last];
    default:
      return undefined;
  }
}

export function TabBar({ current, onChange, panelVisible }: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTab(current, e.key);
    if (next === undefined) return;
    e.preventDefault();
    onChange(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <nav className="tabbar" aria-label="タブ">
      <div
        className="tabbar__list"
        role="tablist"
        aria-label="表示する内容"
        onKeyDown={handleKeyDown}
      >
        {TAB_IDS.map((tab) => {
          const selected = tab === current;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={tabId(tab)}
              className="tabbar__tab"
              aria-selected={selected}
              // パネルは選択中のタブの分しか描画しないので、存在するときだけ指す
              aria-controls={selected && panelVisible ? tabPanelId(tab) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab)}
            >
              {TABS[tab].icon}
              <span className="tabbar__label">{TABS[tab].label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
