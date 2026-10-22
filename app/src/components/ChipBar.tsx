import { TAGS } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import type { CSSProperties } from 'react';

type Props = {
  tags: readonly TagId[];
  /** null は「すべて」 */
  selected: TagId | null;
  onSelect: (tag: TagId | null) => void;
};

/** サブカテゴリの絞り込み。1つだけ選べる */
export function ChipBar({ tags, selected, onSelect }: Props) {
  return (
    <div className="chipbar" role="group" aria-label="サブカテゴリ">
      <button
        type="button"
        className="chip"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        すべて
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="chip"
          style={{ '--tag-color': TAGS[tag].color } as CSSProperties}
          aria-pressed={selected === tag}
          onClick={() => onSelect(tag)}
        >
          {TAGS[tag].label}
        </button>
      ))}
    </div>
  );
}
