import { LANG_MODE_LABELS, LANG_MODES } from '../lib/filter';
import type { LangMode } from '../lib/filter';

type Props = {
  value: LangMode;
  onChange: (value: LangMode) => void;
};

/** 表示する言語の切り替え（日本語＋英語 / 日本語のみ） */
export function LangSwitch({ value, onChange }: Props) {
  return (
    <div className="segmented" role="group" aria-label="表示する言語">
      {LANG_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className="segmented__button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
        >
          {LANG_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
