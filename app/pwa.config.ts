import type { VitePWAOptions } from 'vite-plugin-pwa';

/** ステータスバー・スプラッシュの色。tokens.css の --color-bg に合わせる */
export const THEME_COLOR = { light: '#f2f3f7', dark: '#0b0d12' } as const;

export const manifest = {
  name: 'IT News',
  short_name: 'IT News',
  description: 'AI・セキュリティのニュースと、東京・オンラインのITイベント',
  lang: 'ja',
  start_url: '.',
  scope: '.',
  display: 'standalone',
  orientation: 'portrait',
  background_color: THEME_COLOR.light,
  theme_color: THEME_COLOR.light,
  icons: [
    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} satisfies Partial<VitePWAOptions['manifest']>;

/** 収集した JSON（data/*.json）のキャッシュ名 */
export const DATA_CACHE_NAME = 'itnews-data';

export const pwaOptions = {
  registerType: 'autoUpdate',
  injectRegister: 'script-defer',
  // Cloudflare Access の Cookie を付けて manifest を取得する
  useCredentials: true,
  manifest,
  // manifest のアイコンは globPatterns の png で拾うので、重ねて登録しない
  includeManifestIcons: false,
  workbox: {
    // 画面の部品は事前にキャッシュする。data/*.json は更新されるので含めない
    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    navigateFallback: 'index.html',
    // Cloudflare Access のログイン・ログアウトの URL は index.html で返さない
    navigateFallbackDenylist: [/^\/cdn-cgi\//],
    cleanupOutdatedCaches: true,
    // 新しい SW をすぐ有効にし、初回訪問のページも制御する（data/*.json をキャッシュするため）
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // 通信できるときは最新を取り、オフラインや応答が遅いときは前回のデータを返す
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && /\/data\/[^/]+\.json$/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: DATA_CACHE_NAME,
          networkTimeoutSeconds: 5,
          cacheableResponse: { statuses: [200] },
          expiration: { maxEntries: 10 },
        },
      },
    ],
  },
} satisfies Partial<VitePWAOptions>;
