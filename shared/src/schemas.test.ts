import { describe, expect, it } from 'vitest';
import {
  type Article,
  type Event,
  type Source,
  SUMMARY_MAX_LENGTH,
  articleSchema,
  eventSchema,
  eventsFileSchema,
  newsFileSchema,
  sourceSchema,
  sourcesFileSchema,
} from './schemas';

const article: Article = {
  id: 'abc123',
  title: 'タイトル',
  url: 'https://example.com/a',
  source: 'publickey',
  lang: 'ja',
  publishedAt: '2026-10-22T09:00:00+09:00',
  category: 'ai',
  tags: ['ai-dev'],
  score: 12.5,
  related: [],
};

const event: Event = {
  id: 'connpass-1',
  title: '勉強会',
  url: 'https://example.com/e',
  source: 'connpass',
  type: 'meetup',
  format: 'online',
  startAt: '2026-11-01T19:00:00+09:00',
  tags: [],
};

describe('articleSchema', () => {
  it('正しい記事を受け付ける', () => {
    expect(articleSchema.safeParse(article).success).toBe(true);
    expect(articleSchema.safeParse({ ...article, summary: '抜粋' }).success).toBe(true);
  });

  it('境界値を受け付ける', () => {
    expect(articleSchema.safeParse({ ...article, url: 'http://example.com/a' }).success).toBe(true);
    expect(
      articleSchema.safeParse({ ...article, summary: 'あ'.repeat(SUMMARY_MAX_LENGTH) }).success,
    ).toBe(true);
  });

  it.each([
    ['javascript: のURL', { url: 'javascript:alert(1)' }],
    ['未定義のタグ', { tags: ['ai-unknown'] }],
    ['重複したタグ', { tags: ['ai-dev', 'ai-dev'] }],
    ['未定義のカテゴリ', { category: 'other' }],
    ['不正な日時', { publishedAt: '2026/10/22' }],
    ['タイムゾーンのない日時', { publishedAt: '2026-10-22T09:00:00' }],
    ['data: のURL', { url: 'data:text/html,<script>alert(1)</script>' }],
    ['負の注目度', { score: -1 }],
    ['長すぎる抜粋', { summary: 'あ'.repeat(SUMMARY_MAX_LENGTH + 1) }],
    ['不正な情報源ID', { source: 'Public Key' }],
    ['関連報道の不正なURL', { related: [{ source: 'zenn', url: 'ftp://example.com' }] }],
  ])('%sを弾く', (_, patch) => {
    expect(articleSchema.safeParse({ ...article, ...patch }).success).toBe(false);
  });

  it('必須項目がないと弾く', () => {
    const withoutTitle: Partial<Article> = { ...article };
    delete withoutTitle.title;
    expect(articleSchema.safeParse(withoutTitle).success).toBe(false);
  });
});

describe('eventSchema', () => {
  it('正しいイベントを受け付ける', () => {
    expect(eventSchema.safeParse(event).success).toBe(true);
    expect(
      eventSchema.safeParse({
        ...event,
        endAt: '2026-11-01T21:00:00+09:00',
        capacity: 50,
        accepted: 30,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['終了が開始より前', { endAt: '2026-11-01T18:00:00+09:00' }],
    ['未定義の種別', { type: 'party' }],
    ['未定義の形式', { format: 'remote' }],
    ['未定義の取得元', { source: 'eventbrite' }],
    ['小数の定員', { capacity: 1.5 }],
    ['負の定員', { capacity: -1 }],
    ['負の参加者数', { accepted: -1 }],
  ])('%sを弾く', (_, patch) => {
    expect(eventSchema.safeParse({ ...event, ...patch }).success).toBe(false);
  });

  it('終了と開始が同時刻なら受け付ける', () => {
    expect(eventSchema.safeParse({ ...event, endAt: event.startAt }).success).toBe(true);
  });
});

const source: Source = {
  id: 'publickey',
  name: 'Publickey',
  url: 'https://www.publickey1.jp/',
  feed: 'https://www.publickey1.jp/atom.xml',
  lang: 'ja',
  defaultCategory: 'general',
};

describe('sourceSchema', () => {
  it('フィードURLが http(s) でないと弾く', () => {
    expect(sourceSchema.safeParse(source).success).toBe(true);
    expect(sourceSchema.safeParse({ ...source, feed: 'file:///etc/passwd' }).success).toBe(false);
  });
});

describe('newsFileSchema', () => {
  it('記事IDの重複を弾く', () => {
    const generatedAt = '2026-10-22T03:00:00.000Z';
    expect(newsFileSchema.safeParse({ generatedAt, articles: [article] }).success).toBe(true);
    expect(newsFileSchema.safeParse({ generatedAt, articles: [article, article] }).success).toBe(
      false,
    );
  });
});

describe('eventsFileSchema / sourcesFileSchema', () => {
  it('IDの重複を弾く', () => {
    const generatedAt = '2026-10-22T03:00:00.000Z';
    expect(eventsFileSchema.safeParse({ generatedAt, events: [event] }).success).toBe(true);
    expect(eventsFileSchema.safeParse({ generatedAt, events: [event, event] }).success).toBe(false);
    expect(sourcesFileSchema.safeParse({ sources: [source] }).success).toBe(true);
    expect(sourcesFileSchema.safeParse({ sources: [source, source] }).success).toBe(false);
  });
});
