// プッシュ通知を受け取って表示する（SPEC 8章）。
// vite-plugin-pwa が作る Service Worker から importScripts で読み込む（app/pwa.config.ts）。
// iOS は通知を表示しないプッシュが続くと購読を取り消すので、内容が読めなくても必ず表示する。

const FALLBACK_TITLE = 'IT News';

/** 受け取った内容を読む。JSON でない・形式が違うときは既定の文言にする */
function readPayload(event) {
  let data;
  try {
    data = event.data ? event.data.json() : undefined;
  } catch {
    data = undefined;
  }
  const text = (value) => (typeof value === 'string' && value.trim() !== '' ? value : undefined);
  return {
    title: text(data?.title) ?? FALLBACK_TITLE,
    body: text(data?.body) ?? '新着があります',
    url: text(data?.url),
    tag: text(data?.tag),
  };
}

/** 開く URL。http/https 以外（javascript: など）はアプリのトップにする */
function targetUrl(url) {
  const scope = self.registration.scope;
  if (url === undefined) return scope;
  try {
    const parsed = new URL(url, scope);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : scope;
  } catch {
    return scope;
  }
}

self.addEventListener('push', (event) => {
  const { title, body, url, tag } = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: 'pwa-192x192.png',
      data: { url: targetUrl(url) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? self.registration.scope;
  event.waitUntil(self.clients.openWindow(url));
});
