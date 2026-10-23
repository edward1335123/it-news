// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { pwaOptions } from './pwa.config.ts';

const source = readFileSync(fileURLToPath(new URL('public/push-sw.js', import.meta.url)), 'utf8');
const SCOPE = 'https://news.example.com/';

type Listener = (event: unknown) => void;

/** Service Worker の self を模して push-sw.js を読み込む */
function loadWorker() {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn(() => Promise.resolve());
  const openWindow = vi.fn(() => Promise.resolve(null));
  const self = {
    registration: { scope: SCOPE, showNotification },
    clients: { openWindow },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- 自前のファイルを読み込むだけ
  const run = new Function('self', source) as (self: object) => void;
  run(self);

  /** イベントを送り、waitUntil に渡された数を返す */
  const dispatch = (type: string, event: object): number => {
    let waits = 0;
    listeners.get(type)?.({ ...event, waitUntil: () => (waits += 1) });
    return waits;
  };
  const push = (data: string | undefined) =>
    dispatch('push', {
      data:
        data === undefined ? null : { json: () => JSON.parse(data) as unknown, text: () => data },
    });
  const click = (url: unknown) => {
    const close = vi.fn();
    dispatch('notificationclick', { notification: { data: { url }, close } });
    return close;
  };
  return { push, click, showNotification, openWindow };
}

describe('push-sw.js', () => {
  it('Service Worker から読み込む設定になっている', () => {
    expect(pwaOptions.workbox.importScripts).toEqual(['push-sw.js']);
  });

  it('受け取った内容で通知を表示する', () => {
    const worker = loadWorker();
    const waits = worker.push(
      JSON.stringify({
        title: 'CISA KEV に追加',
        body: '記事',
        url: 'https://a.example/x',
        tag: 'a1',
      }),
    );
    expect(waits).toBe(1);
    expect(worker.showNotification).toHaveBeenCalledWith('CISA KEV に追加', {
      body: '記事',
      tag: 'a1',
      icon: 'pwa-192x192.png',
      data: { url: 'https://a.example/x' },
    });
  });

  it('内容が読めなくても通知を表示する（iOS は表示しないと購読を取り消すため）', () => {
    const worker = loadWorker();
    worker.push('not json');
    worker.push(undefined);
    expect(worker.showNotification).toHaveBeenCalledTimes(2);
    expect(worker.showNotification).toHaveBeenLastCalledWith(
      'IT News',
      expect.objectContaining({ body: '新着があります', data: { url: SCOPE } }),
    );
  });

  it('http/https 以外の URL はアプリのトップにする', () => {
    const worker = loadWorker();
    worker.push(JSON.stringify({ title: 't', body: 'b', url: 'javascript:alert(1)' }));
    expect(worker.showNotification).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ data: { url: SCOPE } }),
    );
  });

  it('通知をタップすると閉じて、URL を開く', () => {
    const worker = loadWorker();
    const close = worker.click('https://a.example/x');
    expect(close).toHaveBeenCalled();
    expect(worker.openWindow).toHaveBeenCalledWith('https://a.example/x');
  });
});
