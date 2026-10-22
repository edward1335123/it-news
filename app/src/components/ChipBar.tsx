import { TAGS } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import { FilterChips } from './FilterChips';

type Props = {
  tags: readonly TagId[];
  /** null は「すべて」 */
  selected: TagId | null;
  onSelect: (tag: TagId | null) => void;
};

/** サブカテゴリの絞り込み。1つだけ選べる */
export function ChipBar({ tags, selected, onSelect }: Props) {
  return (
    <FilterChips
      label="サブカテゴリ"
      options={tags.map((tag) => ({ id: tag, label: TAGS[tag].label, color: TAGS[tag].color }))}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
