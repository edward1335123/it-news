import { afterEach, describe, expect, it, vi } from 'vitest';
import { warmDataCacheOnFirstControl } from './warmDataCache';

/** navigator.serviceWorker の代わり。controller と controllerchange だけを持つ */
function stubServiceWorker(controller: object | null) {
  const container = Object.assign(new EventTarget(), { controller });
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  return container;
}

describe('warmDataCacheOnFirstControl', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.unstubAllGlobals();
  });

  it('SW が初めて制御したときに一度だけ取り直す', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    const sw = stubServiceWorker(null);
    warmDataCacheOnFirstControl(['/data/news.json', '/data/events.json']);
    expect(fetchMock).not.toHaveBeenCalled();

    sw.dispatchEvent(new Event('controllerchange'));
    expect(fetchMock.mock.calls).toEqual([
      ['/data/news.json', { cache: 'no-cache' }],
      ['/data/events.json', { cache: 'no-cache' }],
    ]);

    sw.dispatchEvent(new Event('controllerchange'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('既に制御されているときは何もしない', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    const sw = stubServiceWorker({});
    warmDataCacheOnFirstControl(['/data/news.json']);
    sw.dispatchEvent(new Event('controllerchange'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('取得の失敗は握りつぶす', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('offline')));
    vi.stubGlobal('fetch', fetchMock);
    const sw = stubServiceWorker(null);
    warmDataCacheOnFirstControl(['/data/news.json']);
    sw.dispatchEvent(new Event('controllerchange'));
    await expect(fetchMock.mock.results[0]?.value).rejects.toThrow('offline');
  });

  it('Service Worker が使えない環境では何もしない', () => {
    expect(() => warmDataCacheOnFirstControl(['/data/news.json'])).not.toThrow();
  });
});
