import { useState } from 'react';
import { CloseIcon } from './icons';

type Props = {
  words: readonly string[];
  onAdd: (word: string) => void;
  onRemove: (word: string) => void;
  /** 入力欄のラベル（例: ミュートする語） */
  inputLabel: string;
  /** 一覧のラベル（例: ミュート語の一覧） */
  listLabel: string;
  placeholder: string;
  emptyText: string;
  maxLength: number;
};

/** 語の一覧を追加・削除する（ミュート語・注目キーワード） */
export function WordEditor({
  words,
  onAdd,
  onRemove,
  inputLabel,
  listLabel,
  placeholder,
  emptyText,
  maxLength,
}: Props) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (draft.trim() === '') return;
    onAdd(draft);
    setDraft('');
  };

  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          className="text-input"
          aria-label={inputLabel}
          placeholder={placeholder}
          value={draft}
          maxLength={maxLength}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          className="button"
          aria-label={`${inputLabel}を追加`}
          disabled={draft.trim() === ''}
        >
          追加
        </button>
      </form>
      {words.length === 0 ? (
        <p className="settings__note">{emptyText}</p>
      ) : (
        <ul className="word-list" aria-label={listLabel}>
          {words.map((word) => (
            <li key={word} className="word-list__item">
              <span className="word-list__word">{word}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`${word} を削除`}
                onClick={() => onRemove(word)}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
