import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { pwaOptions } from './pwa.config.ts';

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  test: {
    name: 'app',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
