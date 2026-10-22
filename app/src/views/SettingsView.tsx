import { CATEGORIES } from '@itnews/shared';
import type { SourcesFile } from '@itnews/shared';
import { useState } from 'react';
import { CloseIcon } from '../components/icons';
import { ErrorView, LoadingView } from '../components/StatusView';
import { Switch } from '../components/Switch';
import type { LoadState } from '../lib/useRemoteData';
import {
  MUTED_WORD_MAX_LENGTH,
  addMutedWord,
  removeMutedWord,
  setSourceEnabled,
} from '../lib/userState';
import type { UserState } from '../lib/userState';

type Props = {
  sources: LoadState<SourcesFile>;
  onRetrySources: () => void;
  user: UserState;
};

const LANG_LABELS = { ja: '日本語', en: '英語' } as const;

export function SettingsView({ sources, onRetrySources, user }: Props) {
  return (
    <div className="settings">
      <section className="settings__section" aria-labelledby="settings-display">
        <h2 className="settings__heading" id="settings-display">
          表示
        </h2>
        <div className="settings__group">
          <Switch
            checked={user.prefs.unreadOnly}
            onChange={(unreadOnly) => user.updatePrefs((prev) => ({ ...prev, unreadOnly }))}
            description="既読の記事を AI・セキュリティのタブに表示しません"
          >
            未読のみ表示
          </Switch>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-mute">
        <h2 className="settings__heading" id="settings-mute">
          ミュート語
        </h2>
        <p className="settings__note">
          タイトルか抜粋に含む記事を隠します。全角・半角や大文字・小文字の違いは区別しません
        </p>
        <MutedWords user={user} />
      </section>

      <section className="settings__section" aria-labelledby="settings-sources">
        <h2 className="settings__heading" id="settings-sources">
          情報源
        </h2>
        <p className="settings__note">OFF にした情報源の記事は表示しません</p>
        <SourceList sources={sources} onRetry={onRetrySources} user={user} />
      </section>

      <section className="settings__section" aria-labelledby="settings-notification">
        <h2 className="settings__heading" id="settings-notification">
          通知
        </h2>
        <p className="settings__note">通知の設定は準備中です</p>
      </section>
    </div>
  );
}

function MutedWords({ user }: { user: UserState }) {
  const [draft, setDraft] = useState('');
  const words = user.prefs.mutedWords;

  const submit = () => {
    if (draft.trim() === '') return;
    user.updatePrefs((prev) => addMutedWord(prev, draft));
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
          aria-label="ミュートする語"
          placeholder="例: 求人"
          value={draft}
          maxLength={MUTED_WORD_MAX_LENGTH}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="button" disabled={draft.trim() === ''}>
          追加
        </button>
      </form>
      {words.length === 0 ? (
        <p className="settings__note">ミュート語はありません</p>
      ) : (
        <ul className="word-list" aria-label="ミュート語の一覧">
          {words.map((word) => (
            <li key={word} className="word-list__item">
              <span className="word-list__word">{word}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`${word} を削除`}
                onClick={() => user.updatePrefs((prev) => removeMutedWord(prev, word))}
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

function SourceList({
  sources,
  onRetry,
  user,
}: {
  sources: LoadState<SourcesFile>;
  onRetry: () => void;
  user: UserState;
}) {
  if (sources.status === 'loading') return <LoadingView label="情報源を読み込み中" />;
  if (sources.status === 'error') {
    return (
      <ErrorView
        message="情報源を読み込めませんでした"
        detail={sources.message}
        onRetry={onRetry}
      />
    );
  }
  const disabled = new Set(user.prefs.disabledSources);
  return (
    <ul className="settings__group" aria-label="情報源の一覧">
      {sources.data.sources.map((source) => (
        <li key={source.id}>
          <Switch
            checked={!disabled.has(source.id)}
            onChange={(enabled) =>
              user.updatePrefs((prev) => setSourceEnabled(prev, source.id, enabled))
            }
            description={`${CATEGORIES[source.defaultCategory].label}・${LANG_LABELS[source.lang]}`}
          >
            {source.name}
          </Switch>
        </li>
      ))}
    </ul>
  );
}
