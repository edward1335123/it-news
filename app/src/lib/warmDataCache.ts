/**
 * Service Worker が初めてページを制御したときに、data/*.json を取り直してキャッシュに入れる。
 * 初回訪問の表示時の取得は SW を通らないので、これがないと次回オフラインで開いたときにデータが出ない。
 */
export function warmDataCacheOnFirstControl(urls: readonly string[]): void {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // 既に制御されていれば、表示時の取得で SW がキャッシュしている
  if (sw.controller) return;
  sw.addEventListener(
    'controllerchange',
    () => {
      for (const url of urls) {
        fetch(url, { cache: 'no-cache' }).catch(() => undefined);
      }
    },
    { once: true },
  );
}
