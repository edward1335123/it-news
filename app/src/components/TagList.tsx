import { TAGS } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import type { CSSProperties } from 'react';

type Props = {
  tags: readonly TagId[];
  /** 表示するタグの数の上限。超えた分は出さない */
  max?: number;
};

export function TagList({ tags, max }: Props) {
  if (tags.length === 0) return null;
  return (
    <ul className="tags" aria-label="タグ">
      {tags.slice(0, max).map((tag) => (
        <li key={tag} className="tag" style={{ '--tag-color': TAGS[tag].color } as CSSProperties}>
          {TAGS[tag].label}
        </li>
      ))}
    </ul>
  );
}
