import { DEFAULT_QUIET_HOURS, NOTIFY_KEYWORD_MAX_LENGTH } from '@itnews/shared';
import type { QuietHours } from '@itnews/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { Switch } from '../components/Switch';
import { WordEditor } from '../components/WordEditor';
import {
  VAPID_PUBLIC_KEY,
  buildNotifyConfig,
  detectPushSupport,
  getSubscription,
  subscribe,
  unsubscribe,
} from '../lib/push';
import type { PushSupport } from '../lib/push';
import { addNotifyKeyword, removeNotifyKeyword } from '../lib/userState';
import type { UserState } from '../lib/userState';

/** 購読の操作。テストでは差し替える */
export type PushApi = {
  getSubscription: () => Promise<PushSubscriptionJSON | null>;
  subscribe: (publicKey: string) => Promise<PushSubscriptionJSON>;
  unsubscribe: () => Promise<void>;
};

const browserPushApi: PushApi = {
  getSubscription: async () => (await getSubscription())?.toJSON() ?? null,
  subscribe: async (publicKey) => (await subscribe(publicKey)).toJSON(),
  unsubscribe,
};

type Props = {
  user: UserState;
  support?: PushSupport;
  publicKey?: string;
  api?: PushApi;
};

type Status =
  { kind: 'checking' } | { kind: 'off' } | { kind: 'on'; subscription: PushSubscriptionJSON };

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function NotificationSettings({
  user,
  support = detectPushSupport(),
  publicKey = VAPID_PUBLIC_KEY,
  api = browserPushApi,
}: Props) {
  const usable = support === 'supported' && publicKey !== '';
  const [status, setStatus] = useState<Status>(() =>
    usable ? { kind: 'checking' } : { kind: 'off' },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usable) return;
    let active = true;
    api.getSubscription().then(
      (subscription) => {
        if (active) setStatus(subscription ? { kind: 'on', subscription } : { kind: 'off' });
      },
      (e: unknown) => {
        if (!active) return;
        setStatus({ kind: 'off' });
        setError(errorText(e));
      },
    );
    return () => {
      active = false;
    };
  }, [usable, api]);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        setStatus({ kind: 'on', subscription: await api.subscribe(publicKey) });
      } else {
        await api.unsubscribe();
        setStatus({ kind: 'off' });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const { notifyKeywords, quietHours } = user.prefs;

  return (
    <>
      <p className="settings__note">
        CISA KEV への追加、JPCERT の注意喚起、CVSS 9.0
        以上、注目キーワードを含む新着を通知します（収集のたび、3時間ごと）
      </p>
      <SupportNote support={support} hasPublicKey={publicKey !== ''} />
      <div className="settings__group">
        <Switch
          checked={status.kind === 'on'}
          disabled={!usable || busy || status.kind === 'checking'}
          onChange={(enabled) => void toggle(enabled)}
          description="この端末で通知を受け取ります"
        >
          通知を受け取る
        </Switch>
      </div>
      {error !== null && (
        <p className="settings__error" role="alert">
          {error}
        </p>
      )}

      <h3 className="settings__subheading">注目キーワード</h3>
      <WordEditor
        words={notifyKeywords}
        onAdd={(word) => user.updatePrefs((prev) => addNotifyKeyword(prev, word))}
        onRemove={(word) => user.updatePrefs((prev) => removeNotifyKeyword(prev, word))}
        inputLabel="注目キーワード"
        listLabel="注目キーワードの一覧"
        placeholder="例: Claude Code"
        emptyText="注目キーワードはありません"
        maxLength={NOTIFY_KEYWORD_MAX_LENGTH}
      />

      <h3 className="settings__subheading">静かな時間帯</h3>
      <QuietHoursEditor
        value={quietHours}
        onChange={(next) => user.updatePrefs((prev) => ({ ...prev, quietHours: next }))}
      />

      {status.kind === 'on' && (
        <ConfigOutput
          subscription={status.subscription}
          keywords={notifyKeywords}
          quietHours={quietHours}
        />
      )}
    </>
  );
}

function SupportNote({ support, hasPublicKey }: { support: PushSupport; hasPublicKey: boolean }) {
  if (support === 'needs-install') {
    return (
      <p className="settings__note">
        Safari
        の共有メニューから「ホーム画面に追加」し、ホーム画面のアイコンから開くと通知を使えます
      </p>
    );
  }
  if (support === 'unsupported') {
    return <p className="settings__note">このブラウザはプッシュ通知に対応していません</p>;
  }
  if (!hasPublicKey) {
    return (
      <p className="settings__note">
        VAPID 公開鍵が設定されていないため、通知を使えません（docs/NOTIFY.md）
      </p>
    );
  }
  return null;
}

function QuietHoursEditor({
  value,
  onChange,
}: {
  value: QuietHours | null;
  onChange: (value: QuietHours | null) => void;
}) {
  const id = useId();
  const current = value ?? DEFAULT_QUIET_HOURS;
  const select = (key: keyof QuietHours, label: string) => {
    const other = key === 'start' ? current.end : current.start;
    return (
      <label className="hour-select" htmlFor={`${id}-${key}`}>
        <span>{label}</span>
        <select
          id={`${id}-${key}`}
          className="select"
          value={current[key]}
          disabled={value === null}
          onChange={(e) => onChange({ ...current, [key]: Number(e.target.value) })}
        >
          {HOURS.map((hour) => (
            // 開始と終了を同じ時刻にはできない
            <option key={hour} value={hour} disabled={hour === other}>
              {hour}時
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <div className="settings__group">
      <Switch
        checked={value !== null}
        onChange={(enabled) => onChange(enabled ? current : null)}
        description="この時間帯（日本時間）は通知せず、明けてから送ります"
      >
        静かな時間帯を使う
      </Switch>
      <div className="hour-range">
        {select('start', '開始')}
        <span aria-hidden="true">〜</span>
        {select('end', '終了')}
      </div>
    </div>
  );
}

/** Secret `PUSH_CONFIG` に登録する内容を表示し、コピーできるようにする */
function ConfigOutput({
  subscription,
  keywords,
  quietHours,
}: {
  subscription: PushSubscriptionJSON;
  keywords: readonly string[];
  quietHours: QuietHours | null;
}) {
  const id = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  // コピーした内容。内容が変わったら「コピーしました」を消すため、文字列ごと覚える
  const [copied, setCopied] = useState<{ text: string; how: 'done' | 'select' } | null>(null);
  const config = buildNotifyConfig(subscription, keywords, quietHours);
  const text = config === undefined ? '' : JSON.stringify(config);
  const copiedHow = copied?.text === text ? copied.how : null;

  if (config === undefined) {
    return (
      <p className="settings__error" role="alert">
        購読情報の形式が想定と違います。通知を OFF にしてから ON にし直してください
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ text, how: 'done' });
    } catch {
      // クリップボードを使えないときは選択して、手でコピーしてもらう
      textRef.current?.select();
      setCopied({ text, how: 'select' });
    }
  };

  return (
    <div className="settings__section">
      <h3 className="settings__subheading">
        <label htmlFor={`${id}-config`}>Secret に登録する内容（PUSH_CONFIG）</label>
      </h3>
      <p className="settings__note">
        GitHub の
        Secret「PUSH_CONFIG」に登録します。注目キーワードや静かな時間帯を変えたときも、コピーし直して更新してください。秘密の値なので他の人に見せないでください
      </p>
      <textarea
        ref={textRef}
        id={`${id}-config`}
        className="config-output"
        readOnly
        rows={5}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="inline-form">
        <button type="button" className="button" onClick={() => void copy()}>
          コピー
        </button>
        <span className="settings__note" role="status">
          {copiedHow === 'done' && 'コピーしました'}
          {copiedHow === 'select' && '選択しました。長押しでコピーしてください'}
        </span>
      </div>
    </div>
  );
}
