import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// アイコンの元画像は全面を塗った正方形なので、余白を付けずに背景色だけ合わせる
const BACKGROUND = '#4338ca';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: BACKGROUND } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: BACKGROUND } },
  },
  images: ['public/icon.svg'],
});
