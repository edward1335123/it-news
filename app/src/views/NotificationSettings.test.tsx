import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushSupport } from '../lib/push';
import { storageKey } from '../lib/storage';
import { useUserState } from '../lib/userState';
import { NotificationSettings } from './NotificationSettings';
import type { PushApi } from './NotificationSettings';

const subscription: PushSubscriptionJSON = {
  endpoint: 'https://web.push.apple.com/abc',
  expirationTime: null,
  keys: { p256dh: 'p256', auth: 'auth' },
};

function createApi(initial: PushSubscriptionJSON | null = null) {
  let current = initial;
  const api = {
    getSubscription: vi.fn<PushApi['getSubscription']>(() => Promise.resolve(current)),
    subscribe: vi.fn<PushApi['subscribe']>(() => {
      current = subscription;
      return Promise.resolve(subscription);
    }),
    unsubscribe: vi.fn<PushApi['unsubscribe']>(() => {
      current = null;
      return Promise.resolve();
    }),
  };
  return api;
}

function Harness(props: { api: PushApi; support?: PushSupport; publicKey?: string }) {
  const user = useUserState();
  return (
    <NotificationSettings
      user={user}
      api={props.api}
      support={props.support ?? 'supported'}
      publicKey={props.publicKey ?? 'BPublicKey'}
    />
  );
}

const notifySwitch = () => screen.getByRole('switch', { name: '通知を受け取る' });
const configText = () =>
  screen.getByRole('textbox', { name: 'Secret に登録する内容（PUSH_CONFIG）' });

describe('NotificationSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ON にすると購読し、Secret に登録する内容を表示する', async () => {
    const user = userEvent.setup();
    const api = createApi();
    render(<Harness api={api} />);
    await waitFor(() => expect(notifySwitch()).toBeEnabled());
    expect(notifySwitch()).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: /PUSH_CONFIG/ })).not.toBeInTheDocument();

    await user.click(notifySwitch());
    expect(api.subscribe).toHaveBeenCalledWith('BPublicKey');
    expect(notifySwitch()).toBeChecked();
    expect(JSON.parse((configText() as HTMLTextAreaElement).value)).toEqual({
      subscription,
      keywords: [],
      quietHours: { start: 23, end: 7 },
    });
  });

  it('注目キーワードや静かな時間帯を変えると、登録する内容も変わり、端末内に保存する', async () => {
    const user = userEvent.setup();
    render(<Harness api={createApi(subscription)} />);
    await waitFor(() => expect(notifySwitch()).toBeChecked());

    await user.type(screen.getByRole('textbox', { name: '注目キーワード' }), 'MCP{Enter}');
    await user.selectOptions(screen.getByRole('combobox', { name: '開始' }), '22');
    const value = () => JSON.parse((configText() as HTMLTextAreaElement).value) as unknown;
    expect(value()).toMatchObject({ keywords: ['MCP'], quietHours: { start: 22, end: 7 } });

    await user.click(screen.getByRole('switch', { name: '静かな時間帯を使う' }));
    expect(value()).toMatchObject({ quietHours: null });
    expect(screen.getByRole('combobox', { name: '開始' })).toBeDisabled();

    const stored = JSON.parse(localStorage.getItem(storageKey('prefs')) ?? '{}') as unknown;
    expect(stored).toMatchObject({ notifyKeywords: ['MCP'], quietHours: null });
  });

  it('開始と終了に同じ時刻は選べない', async () => {
    render(<Harness api={createApi()} />);
    const start = screen.getByRole('combobox', { name: '開始' });
    expect(screen.getAllByRole('option', { name: '7時' })[0]).toBeDisabled();
    expect(start).toHaveValue('23');
    await waitFor(() => expect(notifySwitch()).toBeEnabled());
  });

  it('コピーボタンでクリップボードにコピーする', async () => {
    const user = userEvent.setup();
    render(<Harness api={createApi(subscription)} />);
    await waitFor(() => expect(notifySwitch()).toBeChecked());

    await user.click(screen.getByRole('button', { name: 'コピー' }));
    expect(await navigator.clipboard.readText()).toBe((configText() as HTMLTextAreaElement).value);
    expect(screen.getByRole('status')).toHaveTextContent('コピーしました');
  });

  it('OFF にすると購読をやめ、登録する内容を隠す', async () => {
    const user = userEvent.setup();
    const api = createApi(subscription);
    render(<Harness api={api} />);
    await waitFor(() => expect(notifySwitch()).toBeChecked());

    await user.click(notifySwitch());
    expect(api.unsubscribe).toHaveBeenCalled();
    expect(notifySwitch()).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: /PUSH_CONFIG/ })).not.toBeInTheDocument();
  });

  it('購読に失敗したら理由を表示する', async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.subscribe.mockRejectedValue(new Error('通知が許可されていません'));
    render(<Harness api={api} />);
    await waitFor(() => expect(notifySwitch()).toBeEnabled());

    await user.click(notifySwitch());
    expect(screen.getByRole('alert')).toHaveTextContent('通知が許可されていません');
    expect(notifySwitch()).not.toBeChecked();
  });

  it('iPhone の Safari で開いているときは、ホーム画面への追加を案内する', () => {
    const api = createApi();
    render(<Harness api={api} support="needs-install" />);
    expect(screen.getByText(/ホーム画面に追加/)).toBeInTheDocument();
    expect(notifySwitch()).toBeDisabled();
    expect(api.getSubscription).not.toHaveBeenCalled();
  });

  it('VAPID 公開鍵がないビルドでは使えないことを示す', () => {
    render(<Harness api={createApi()} publicKey="" />);
    expect(screen.getByText(/VAPID 公開鍵が設定されていない/)).toBeInTheDocument();
    expect(notifySwitch()).toBeDisabled();
  });
});
