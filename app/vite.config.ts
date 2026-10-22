import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { mockDataFallback } from './mockDataFallback.ts';
import { pwaOptions } from './pwa.config.ts';

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions), mockDataFallback(resolve(import.meta.dirname, 'mock'))],
  test: {
    name: 'app',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
