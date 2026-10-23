/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** VAPID 公開鍵。ビルド時に環境変数で渡す（docs/NOTIFY.md） */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
