import { CATEGORIES } from '@itnews/shared';
import type { SourcesFile } from '@itnews/shared';
import { LangSwitch } from '../components/LangSwitch';
import { ErrorView, LoadingView } from '../components/StatusView';
import { Switch } from '../components/Switch';
import { WordEditor } from '../components/WordEditor';
import type { LoadState } from '../lib/useRemoteData';
import {
  MUTED_WORD_MAX_LENGTH,
  addMutedWord,
  removeMutedWord,
  setSourceEnabled,
} from '../lib/userState';
import type { UserState } from '../lib/userState';
import { NotificationSettings } from './NotificationSettings';

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
          <div className="setting-row">
            <span className="switch__text">
              <span className="switch__label">表示する言語</span>
              <span className="switch__description">
                AI・セキュリティ・検索結果に適用します。保存した記事は言語に関係なく表示します
              </span>
            </span>
            <LangSwitch
              value={user.prefs.langMode}
              onChange={(langMode) => user.updatePrefs((prev) => ({ ...prev, langMode }))}
            />
          </div>
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
        <NotificationSettings user={user} />
      </section>
    </div>
  );
}

function MutedWords({ user }: { user: UserState }) {
  return (
    <WordEditor
      words={user.prefs.mutedWords}
      onAdd={(word) => user.updatePrefs((prev) => addMutedWord(prev, word))}
      onRemove={(word) => user.updatePrefs((prev) => removeMutedWord(prev, word))}
      inputLabel="ミュートする語"
      listLabel="ミュート語の一覧"
      placeholder="例: 求人"
      emptyText="ミュート語はありません"
      maxLength={MUTED_WORD_MAX_LENGTH}
    />
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
