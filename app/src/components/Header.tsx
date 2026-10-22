import { BackIcon, SearchIcon, SettingsIcon } from './icons';

type Props = {
  title: string;
  /** 指定すると戻るボタンを出し、検索・設定のボタンを隠す */
  onBack?: () => void;
  onSearch?: () => void;
  onSettings?: () => void;
};

export function Header({ title, onBack, onSearch, onSettings }: Props) {
  return (
    <header className="header">
      {onBack && (
        <button type="button" className="icon-button" aria-label="戻る" onClick={onBack}>
          <BackIcon />
        </button>
      )}
      <h1 className="header__title">{title}</h1>
      {!onBack && (
        <div className="header__actions">
          <button type="button" className="icon-button" aria-label="検索" onClick={onSearch}>
            <SearchIcon />
          </button>
          <button type="button" className="icon-button" aria-label="設定" onClick={onSettings}>
            <SettingsIcon />
          </button>
        </div>
      )}
    </header>
  );
}
