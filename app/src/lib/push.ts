import { notifyConfigSchema } from '@itnews/shared';
import type { NotifyConfig, QuietHours } from '@itnews/shared';

/**
 * プッシュ通知の購読（SPEC 8章）。
 * 購読情報はサーバーに送らず、画面に表示して利用者が GitHub Actions の Secret に登録する。
 */

/** ビルド時に埋め込む VAPID 公開鍵（公開してよい値。秘密鍵は notifier だけが持つ） */
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? '';

/** Service Worker の準備を待つ時間。開発サーバーでは Service Worker が動かないので待ち続けない */
const SW_READY_TIMEOUT_MS = 10_000;

export type PushSupport =
  /** 購読できる */
  | 'supported'
  /** iPhone の Safari で開いている。ホーム画面に追加すると使える */
  | 'needs-install'
  /** このブラウザでは使えない */
  | 'unsupported';

type PushEnv = {
  window: Pick<Window, 'matchMedia'> & { PushManager?: unknown; Notification?: unknown };
  navigator: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
    serviceWorker?: unknown;
    standalone?: boolean;
  };
};

/** iPhone・iPad か。iPadOS の Safari は Mac と同じ userAgent なので、タッチ対応で見分ける */
function isIos(nav: PushEnv['navigator']): boolean {
  return (
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)
  );
}

function isStandalone(env: PushEnv): boolean {
  return (
    env.navigator.standalone === true || env.window.matchMedia('(display-mode: standalone)').matches
  );
}

export function detectPushSupport(env: PushEnv = { window, navigator }): PushSupport {
  const available =
    'serviceWorker' in env.navigator && 'PushManager' in env.window && 'Notification' in env.window;
  if (available) return 'supported';
  // iOS はホーム画面に追加した PWA でだけ Web Push が使える（iOS 16.4 以降）
  return isIos(env.navigator) && !isStandalone(env) ? 'needs-install' : 'unsupported';
}

/** VAPID 公開鍵（base64url）を applicationServerKey の形にする */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Service Worker が動いていません（開発サーバーでは使えません）')),
      SW_READY_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** 今の購読。購読していなければ null */
export async function getSubscription(): Promise<PushSubscription | null> {
  const registration = await readyRegistration();
  return registration.pushManager.getSubscription();
}

/** 2つの鍵が同じバイト列か */
export function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (a === null || a.byteLength !== b.length) return false;
  const bytes = new Uint8Array(a);
  return bytes.every((byte, i) => byte === b[i]);
}

/**
 * 通知を許可してもらい、購読する。同じ公開鍵ですでに購読していればそれを返す。
 * VAPID 鍵を作り直した後の古い購読は送信が 403 になるので、解除して購読し直す。
 * iOS では利用者の操作（タップ）の中で呼ぶ必要がある。
 */
export async function subscribe(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('通知が許可されていません。iPhone の「設定」→「通知」から許可してください');
  }
  const registration = await readyRegistration();
  const key = base64UrlToBytes(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing !== null) {
    if (sameKey(existing.options.applicationServerKey, key)) return existing;
    await existing.unsubscribe();
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** 購読をやめる。購読していなければ何もしない */
export async function unsubscribe(): Promise<void> {
  const subscription = await getSubscription();
  await subscription?.unsubscribe();
}

/**
 * Secret `PUSH_CONFIG` に登録する内容を作る。
 * 購読情報の形が正しくなければ undefined（ブラウザが想定外の値を返したとき）。
 */
export function buildNotifyConfig(
  subscription: PushSubscriptionJSON,
  keywords: readonly string[],
  quietHours: QuietHours | null,
): NotifyConfig | undefined {
  const result = notifyConfigSchema.safeParse({ subscription, keywords, quietHours });
  return result.success ? result.data : undefined;
}
