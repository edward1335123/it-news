import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('空のトップ画面にアプリ名を表示する', () => {
    expect(renderToStaticMarkup(<App />)).toContain('<h1>IT News</h1>');
  });
});
