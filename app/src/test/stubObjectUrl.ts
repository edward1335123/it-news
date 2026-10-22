import { vi } from 'vitest';
import type { Mock } from 'vitest';

const KEYS = ['createObjectURL', 'revokeObjectURL'] as const;

export type ObjectUrlStub = {
  blobs: Blob[];
  revoke: Mock<(url: string) => void>;
  restore: () => void;
};

/**
 * `URL.createObjectURL` / `revokeObjectURL` を差し替える（jsdom には実装がない）。
 * 作った Blob は `blobs` に入る。テストの最後に `restore` を呼ぶ。
 */
export function stubObjectUrl(url = 'blob:test'): ObjectUrlStub {
  const saved = KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(URL, key)] as const);
  const blobs: Blob[] = [];
  const revoke = vi.fn<(url: string) => void>();
  const define = (key: (typeof KEYS)[number], value: unknown) =>
    Object.defineProperty(URL, key, { configurable: true, writable: true, value });
  define('createObjectURL', (blob: Blob) => {
    blobs.push(blob);
    return url;
  });
  define('revokeObjectURL', revoke);

  return {
    blobs,
    revoke,
    restore() {
      for (const [key, descriptor] of saved) {
        if (descriptor === undefined) Reflect.deleteProperty(URL, key);
        else Object.defineProperty(URL, key, descriptor);
      }
    },
  };
}
