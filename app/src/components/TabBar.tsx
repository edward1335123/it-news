import { TAB_IDS, TABS, tabId, tabPanelId } from '../tabs';
import type { TabId } from '../tabs';

type Props = {
  current: TabId;
  onChange: (tab: TabId) => void;
};

export function TabBar({ current, onChange }: Props) {
  return (
    <nav className="tabbar">
      <div className="tabbar__list" role="tablist" aria-label="表示する内容">
        {TAB_IDS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={tabId(tab)}
            className="tabbar__tab"
            aria-selected={tab === current}
            aria-controls={tabPanelId(tab)}
            onClick={() => onChange(tab)}
          >
            {TABS[tab].icon}
            <span className="tabbar__label">{TABS[tab].label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
