// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DATA_CACHE_NAME, THEME_COLOR, manifest, pwaOptions } from './pwa.config.ts';

const appDir = fileURLToPath(new URL('.', import.meta.url));
const publicFile = (name: string) => `${appDir}public/${name}`;
const indexHtml = readFileSync(`${appDir}index.html`, 'utf8');

/** PNG の IHDR から幅と高さを読む */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString('ascii'), path).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('manifest', () => {
  it('インストールに必要な項目がある', () => {
    expect(manifest.name).not.toBe('');
    expect(manifest.short_name).not.toBe('');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('.');
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('192px・512px のアイコンとマスカブルアイコンがあり、実ファイルの大きさと一致する', () => {
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(publicFile(icon.src)), icon.src).toEqual({ width: w, height: h });
    }
    const anySizes = manifest.icons.filter((i) => !('purpose' in i)).map((i) => i.sizes);
    expect(anySizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => 'purpose' in i && i.purpose === 'maskable')).toBe(true);
  });
});

describe('index.html', () => {
  it('iOS 向けの meta と apple-touch-icon（180px）がある', () => {
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(indexHtml).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-title"');
    const href = /<link rel="apple-touch-icon" href="\/([^"]+)"/.exec(indexHtml)?.[1];
    expect(href).toBeDefined();
    expect(pngSize(publicFile(href ?? ''))).toEqual({ width: 180, height: 180 });
  });

  it('theme-color がライト・ダークの背景色と一致する', () => {
    const tokens = readFileSync(`${appDir}src/styles/tokens.css`, 'utf8');
    const bgColors = [...tokens.matchAll(/--color-bg: (#[0-9a-f]{6});/g)].map((m) => m[1]);
    expect(bgColors).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
    expect(indexHtml).toContain(
      `<meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)" />`,
    );
    expect(indexHtml).toContain(
      `<meta name="theme-color" content="${THEME_COLOR.dark}" media="(prefers-color-scheme: dark)" />`,
    );
  });
});

describe('Service Worker のキャッシュ', () => {
  const [dataRoute] = pwaOptions.workbox.runtimeCaching;
  type MatchOptions = Parameters<NonNullable<typeof dataRoute>['urlPattern']>[0];
  const matches = (href: string, sameOrigin = true) => {
    const url = new URL(href);
    // 判定に使わない event は渡さない（Node には ExtendableEvent がない）
    const options = { url, sameOrigin, request: new Request(url) } as MatchOptions;
    return dataRoute?.urlPattern(options) ?? false;
  };

  it('data/*.json だけを NetworkFirst でキャッシュする', () => {
    expect(dataRoute?.handler).toBe('NetworkFirst');
    expect(dataRoute?.options.cacheName).toBe(DATA_CACHE_NAME);
    expect(matches('https://example.com/data/news.json')).toBe(true);
    expect(matches('https://example.com/app/data/events.json?v=1')).toBe(true);
    expect(matches('https://example.com/assets/index.js')).toBe(false);
    expect(matches('https://example.com/data/news.json.bak')).toBe(false);
    expect(matches('https://other.example.com/data/news.json', false)).toBe(false);
  });

  it('新しい SW をすぐ有効にし、初回訪問のページも制御する', () => {
    expect(pwaOptions.workbox.skipWaiting).toBe(true);
    expect(pwaOptions.workbox.clientsClaim).toBe(true);
  });

  it('Cloudflare Access の URL は index.html で返さない', () => {
    const denied = (path: string) =>
      pwaOptions.workbox.navigateFallbackDenylist.some((re) => re.test(path));
    expect(denied('/cdn-cgi/access/logout')).toBe(true);
    expect(denied('/')).toBe(false);
  });

  it('データの JSON は事前キャッシュに含めない', () => {
    expect(pwaOptions.workbox.globPatterns.join()).not.toContain('json');
  });
});
