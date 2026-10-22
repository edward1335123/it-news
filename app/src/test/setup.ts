import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// globals を有効にしていないので、描画した DOM は各テストの後に明示的に片付ける
afterEach(() => {
  cleanup();
});
