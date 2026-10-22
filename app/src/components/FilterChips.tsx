import type { CSSProperties } from 'react';

export type ChipOption<T extends string> = {
  id: T;
  label: string;
  /** チップの左に出す色の点 */
  color?: string;
};

type Props<T extends string> = {
  /** 読み上げ用のグループ名 */
  label: string;
  options: readonly ChipOption<T>[];
  /** null は「すべて」 */
  selected: T | null;
  onSelect: (id: T | null) => void;
  /** 先頭に「すべて」を出すか */
  showAll?: boolean;
};

/** 1つだけ選べるチップの列。先頭に「すべて」を置く */
export function FilterChips<T extends string>({
  label,
  options,
  selected,
  onSelect,
  showAll = true,
}: Props<T>) {
  return (
    <div className="chipbar" role="group" aria-label={label}>
      {showAll && (
        <button
          type="button"
          className="chip"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          すべて
        </button>
      )}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="chip"
          style={
            option.color === undefined
              ? undefined
              : ({ '--tag-color': option.color } as CSSProperties)
          }
          aria-pressed={selected === option.id}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
