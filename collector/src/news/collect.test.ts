import { SUMMARY_MAX_LENGTH, newsFileSchema } from '@itnews/shared';
import type { Article, Source } from '@itnews/shared';
import { describe, expect, it, vi } from 'vitest';
import { MAX_ARTICLES_PER_SOURCE, buildNews, collectNews, toArticles } from './collect';
import type { Logger } from './collect';
import type { FeedItem } from './feed';
import { articleId } from './url';

const NOW = Date.parse('2026-10-23T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function source(id: string, overrides: Partial<Source> = {}): Source {
  return {
    id,
    name: id,
    url: `https://${id}.example/`,
    feed: `https://${id}.example/feed.xml`,
    lang: 'en',
    defaultCategory: 'security',
    ...overrides,
  };
}

function rss(items: { title: string; link: string; date: string }[]): string {
  const body = items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.date}</pubDate></item>`,
    )
    .join('');
  return `<rss version="2.0"><channel>${body}</channel></rss>`;
}

function silentLog() {
  const log = {
    info: vi.fn<Logger['info']>(),
    warn: vi.fn<Logger['warn']>(),
    error: vi.fn<Logger['error']>(),
  };
  return log satisfies Logger;
}

describe('toArticles', () => {
  const src = source('news');

  it('正規化・分類して記事にする', () => {
    const items: FeedItem[] = [
      {
        title: 'Ransomware gang &amp; <b>breach</b>',
        url: '/a?utm_source=rss',
        publishedAt: iso(NOW - DAY),
        summary: '<p>Details</p>',
      },
    ];
    expect(toArticles(src, items, NOW)).toEqual([
      {
        id: articleId('https://news.example/a'),
        title: 'Ransomware gang & breach',
        url: 'https://news.example/a',
        source: 'news',
        lang: 'en',
        publishedAt: iso(NOW - DAY),
        summary: 'Details',
        category: 'security',
        tags: ['sec-incident', 'sec-malware'],
        score: 0,
        related: [],
      },
    ]);
  });

  it('抜粋を200字に切り詰め、arXiv の前置きを除く', () => {
    const long = 'x'.repeat(500);
    const [a] = toArticles(src, [{ title: 'T', url: 'https://n.example/1', summary: long }], NOW);
    expect(a?.summary).toHaveLength(SUMMARY_MAX_LENGTH);
    const arxiv = 'arXiv:2610.12345v1 Announce Type: new Abstract: We propose a method.';
    const [b] = toArticles(src, [{ title: 'T', url: 'https://n.example/2', summary: arxiv }], NOW);
    expect(b?.summary).toBe('We propose a method.');
  });

  it('日時がなければ今、未来の日時は今にし、30日より古い項目は捨てる', () => {
    const items: FeedItem[] = [
      { title: 'no date', url: 'https://n.example/1' },
      { title: 'future', url: 'https://n.example/2', publishedAt: iso(NOW + DAY) },
      { title: 'old', url: 'https://n.example/3', publishedAt: iso(NOW - 31 * DAY) },
    ];
    const articles = toArticles(src, items, NOW);
    expect(articles.map((a) => [a.title, a.publishedAt])).toEqual([
      ['no date', iso(NOW)],
      ['future', iso(NOW)],
    ]);
  });

  it('URL が不正・タイトルが空・同じ URL の項目は捨てる', () => {
    const items: FeedItem[] = [
      { title: 'ok', url: 'https://n.example/1' },
      { title: 'dup', url: 'https://n.example/1#x' },
      { title: 'bad', url: 'javascript:alert(1)' },
      { title: '<br>', url: 'https://n.example/2' },
    ];
    expect(toArticles(src, items, NOW).map((a) => a.title)).toEqual(['ok']);
  });

  it('情報源の設定に従う（Hacker News は抜粋を保存しない、arXiv cs.CR はタグがなければ捨てる）', () => {
    const hn = toArticles(
      source('hacker-news', { defaultCategory: 'general' }),
      [{ title: 'Show HN', url: 'https://x.example/', summary: 'Points: 10' }],
      NOW,
    );
    expect(hn[0]?.summary).toBeUndefined();
    const cr = toArticles(
      source('arxiv-cs-cr'),
      [
        { title: 'A lattice-based signature scheme', url: 'https://arxiv.org/abs/1' },
        { title: 'Prompt injection attacks on LLM agents', url: 'https://arxiv.org/abs/2' },
      ],
      NOW,
    );
    expect(cr.map((a) => a.url)).toEqual(['https://arxiv.org/abs/2']);
  });
});

describe('buildNews', () => {
  const sources = [source('a'), source('b')];
  const previousArticle: Article = {
    id: 'prev',
    title: 'Old but kept',
    url: 'https://a.example/prev',
    source: 'a',
    lang: 'en',
    publishedAt: iso(NOW - 10 * DAY),
    category: 'security',
    tags: ['sec-vuln'],
    score: 99,
    related: [{ source: 'removed', url: 'https://removed.example/x' }],
  };

  it('前回の記事を残し、30日より古い記事と登録されていない情報源を除く', () => {
    const expired = {
      ...previousArticle,
      id: 'exp',
      url: 'https://a.example/exp',
      publishedAt: iso(NOW - 31 * DAY),
    };
    const unknown = { ...previousArticle, id: 'unk', url: 'https://z.example/', source: 'removed' };
    const result = buildNews({
      previous: [previousArticle, expired, unknown],
      outcomes: [],
      sources,
      now: NOW,
    });
    expect(result.map((a) => a.id)).toEqual(['prev']);
    expect(result[0]?.related).toEqual([]);
    // 注目度は計算し直す
    expect(result[0]?.score).toBe(10);
  });

  it('新しい順に並べ、情報源ごとに上限件数まで残す', () => {
    const many = Array.from({ length: MAX_ARTICLES_PER_SOURCE + 5 }, (_, i) => ({
      ...previousArticle,
      id: `p${i}`,
      url: `https://a.example/${i}`,
      publishedAt: iso(NOW - i * 60_000),
    }));
    const result = buildNews({ previous: many, outcomes: [], sources, now: NOW });
    expect(result).toHaveLength(MAX_ARTICLES_PER_SOURCE);
    expect(result[0]?.id).toBe('p0');
  });

  it('Hacker News のポイントを、同じ URL の記事の注目度に加える', () => {
    const hn = source('hacker-news', { defaultCategory: 'general' });
    const result = buildNews({
      previous: [],
      outcomes: [
        {
          source: sources[0] as Source,
          ok: true,
          items: [
            { title: 'Vuln found', url: 'https://a.example/v', publishedAt: iso(NOW - 3 * DAY) },
          ],
        },
        {
          source: hn,
          ok: true,
          items: [
            {
              title: 'Vuln found (HN)',
              url: 'https://a.example/v',
              publishedAt: iso(NOW - 3 * DAY),
              points: 100,
            },
          ],
        },
      ],
      sources: [...sources, hn],
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.score).toBe(10 + 35);
  });
});

describe('collectNews', () => {
  it('一部の情報源が失敗しても他の情報源の記事を出力し、失敗をログに残す', async () => {
    const sources = [source('good'), source('down'), source('broken')];
    const feeds: Record<string, string> = {
      'https://good.example/feed.xml': rss([
        { title: 'Ransomware hits hospital', link: 'https://good.example/1', date: iso(NOW - DAY) },
      ]),
      'https://broken.example/feed.xml': '<!DOCTYPE html><html></html>',
    };
    const fetchFeed = (url: string) => {
      const body = feeds[url];
      return body === undefined ? Promise.reject(new Error('HTTP 503')) : Promise.resolve(body);
    };
    const log = silentLog();

    const { articles, failures } = await collectNews({
      sources,
      previous: [],
      fetchFeed,
      now: NOW,
      log,
    });

    expect(articles.map((a) => a.title)).toEqual(['Ransomware hits hospital']);
    expect(failures).toEqual([
      { sourceId: 'down', error: 'HTTP 503' },
      { sourceId: 'broken', error: 'RSS・Atom として読めない' },
    ]);
    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('down'));
    expect(newsFileSchema.safeParse({ generatedAt: iso(NOW), articles }).success).toBe(true);
  });
});
