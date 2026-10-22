import { describe, expect, it, vi } from 'vitest';
import { createHostQueue, createPoliteFetcher } from './fetcher';
import type { HttpResponse } from './fetcher';
import { isAllowed, parseRobots } from './robots';

describe('parseRobots・isAllowed', () => {
  const robots = `
# comment
User-agent: *
Disallow: /private/
Disallow: */feed/
Allow: /private/feed.xml$

User-agent: GPTBot
User-agent: itnews-pwa-collector
Disallow: /blocked/
`;

  it('自分のトークンのグループがあればそれを使う', () => {
    const rules = parseRobots(robots, 'itnews-pwa-collector');
    expect(isAllowed(rules, '/blocked/rss')).toBe(false);
    expect(isAllowed(rules, '/private/x')).toBe(true);
  });

  it('なければ * のグループを使い、最長一致・Allow 優先で判定する', () => {
    const rules = parseRobots(robots, 'other-bot');
    expect(isAllowed(rules, '/private/x')).toBe(false);
    expect(isAllowed(rules, '/private/feed.xml')).toBe(true);
    expect(isAllowed(rules, '/private/feed.xml?x=1')).toBe(false);
    expect(isAllowed(rules, '/blog/feed/')).toBe(false);
    expect(isAllowed(rules, '/blog/')).toBe(true);
  });

  it('空の Disallow は制限なし、Disallow: / はすべて禁止', () => {
    expect(isAllowed(parseRobots('User-agent: *\nDisallow:', 'x'), '/feed')).toBe(true);
    expect(isAllowed(parseRobots('User-agent: *\nDisallow: /', 'x'), '/feed')).toBe(false);
  });
});

describe('createHostQueue', () => {
  it('同じホストは順番に間隔をあけ、別のホストは待たない', async () => {
    const events: string[] = [];
    const wait = vi.fn((ms: number) => {
      events.push(`wait ${ms}`);
      return Promise.resolve();
    });
    const enqueue = createHostQueue(1000, wait);
    const task = (name: string) => () => {
      events.push(name);
      return Promise.resolve(name);
    };
    await Promise.all([
      enqueue('a.example', task('a1')),
      enqueue('a.example', task('a2')),
      enqueue('b.example', task('b1')),
    ]);
    expect(events).toEqual(['a1', 'b1', 'wait 1000', 'a2']);
  });

  it('前の処理が失敗しても次の処理を実行する', async () => {
    const enqueue = createHostQueue(0, () => Promise.resolve());
    const failed = enqueue('a', () => Promise.reject(new Error('x')));
    await expect(failed).rejects.toThrow('x');
    await expect(enqueue('a', () => Promise.resolve(1))).resolves.toBe(1);
  });
});

describe('createPoliteFetcher', () => {
  function setup(responses: Record<string, HttpResponse>) {
    const get = vi.fn((url: string) => {
      const res = responses[url];
      return res === undefined ? Promise.reject(new Error('network')) : Promise.resolve(res);
    });
    const fetchFeed = createPoliteFetcher({
      get,
      productToken: 'itnews-pwa-collector',
      intervalMs: 0,
      wait: () => Promise.resolve(),
    });
    return { get, fetchFeed };
  }
  const ok = (body: string, contentType = 'text/plain'): HttpResponse => ({
    status: 200,
    contentType,
    body,
  });

  it('robots.txt を1回だけ取得し、許可されたフィードを返す', async () => {
    const { get, fetchFeed } = setup({
      'https://a.example/robots.txt': ok('User-agent: *\nDisallow: /private/'),
      'https://a.example/feed.xml': ok('<rss/>'),
      'https://a.example/feed2.xml': ok('<rss>2</rss>'),
    });
    await expect(fetchFeed('https://a.example/feed.xml')).resolves.toBe('<rss/>');
    await expect(fetchFeed('https://a.example/feed2.xml')).resolves.toBe('<rss>2</rss>');
    expect(get.mock.calls.filter(([url]) => url.endsWith('robots.txt'))).toHaveLength(1);
  });

  it('robots.txt で禁止されたフィードは取得しない', async () => {
    const { get, fetchFeed } = setup({
      'https://a.example/robots.txt': ok('User-agent: *\nDisallow: /'),
    });
    await expect(fetchFeed('https://a.example/feed.xml')).rejects.toThrow('robots.txt');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('robots.txt がない・HTML を返すときは制限なしとみなす', async () => {
    const { fetchFeed } = setup({
      'https://a.example/robots.txt': { status: 404, contentType: 'text/html', body: '' },
      'https://a.example/feed.xml': ok('a'),
      'https://b.example/robots.txt': ok('<!DOCTYPE html><p>Disallow: /</p>', 'text/html'),
      'https://b.example/feed.xml': ok('b'),
    });
    await expect(fetchFeed('https://a.example/feed.xml')).resolves.toBe('a');
    await expect(fetchFeed('https://b.example/feed.xml')).resolves.toBe('b');
  });

  it('robots.txt が 5xx ならフィードを取得しない', async () => {
    const { fetchFeed } = setup({
      'https://a.example/robots.txt': { status: 503, contentType: 'text/plain', body: '' },
      'https://a.example/feed.xml': ok('a'),
    });
    await expect(fetchFeed('https://a.example/feed.xml')).rejects.toThrow('HTTP 503');
  });

  it('フィードが 2xx 以外なら例外にする', async () => {
    const { fetchFeed } = setup({
      'https://a.example/robots.txt': ok(''),
      'https://a.example/feed.xml': { status: 404, contentType: 'text/html', body: '' },
    });
    await expect(fetchFeed('https://a.example/feed.xml')).rejects.toThrow('HTTP 404');
  });
});
