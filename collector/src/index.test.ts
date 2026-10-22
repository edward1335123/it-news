import { describe, expect, it } from 'vitest';
import { describeCollector } from './index';

describe('collector', () => {
  it('shared パッケージを参照できる', () => {
    expect(describeCollector()).toBe('IT News collector');
  });
});
