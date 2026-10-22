import { describe, expect, it } from 'vitest';
import { APP_NAME } from './index';

describe('shared', () => {
  it('アプリ名を公開している', () => {
    expect(APP_NAME).toBe('IT News');
  });
});
