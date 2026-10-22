import { TAGS } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import type { CSSProperties } from 'react';

export function TagList({ tags }: { tags: readonly TagId[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="tags" aria-label="タグ">
      {tags.map((tag) => (
        <li key={tag} className="tag" style={{ '--tag-color': TAGS[tag].color } as CSSProperties}>
          {TAGS[tag].label}
        </li>
      ))}
    </ul>
  );
}
