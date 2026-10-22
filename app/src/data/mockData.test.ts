import {
  CATEGORY_IDS,
  CATEGORY_TAGS,
  EVENT_FORMAT_IDS,
  EVENT_SOURCE_IDS,
  EVENT_TYPE_IDS,
  TAG_IDS,
  eventsFileSchema,
  newsFileSchema,
  sourcesFileSchema,
} from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import eventsJson from '../../public/data/events.json';
import newsJson from '../../public/data/news.json';
import sourcesJson from '../../public/data/sources.json';

/** app/public/data/ のモックJSONを検証する */
describe('モックデータ', () => {
  const { sources } = sourcesFileSchema.parse(sourcesJson);
  const { articles } = newsFileSchema.parse(newsJson);
  const { events } = eventsFileSchema.parse(eventsJson);
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  describe('news.json', () => {
    it('60件以上ある', () => {
      expect(articles.length).toBeGreaterThanOrEqual(60);
    });

    it('全サブカテゴリ・全カテゴリ・日英を網羅する', () => {
      expect(new Set(articles.flatMap((a) => a.tags))).toEqual(new Set(TAG_IDS));
      expect(new Set(articles.map((a) => a.category))).toEqual(new Set(CATEGORY_IDS));
      expect(new Set(articles.map((a) => a.lang))).toEqual(new Set(['ja', 'en']));
    });

    it('情報源が sources.json に存在し、言語が一致する', () => {
      for (const a of articles) {
        expect(sourceById.get(a.source)?.lang, a.id).toBe(a.lang);
        for (const r of a.related) {
          expect(sourceById.has(r.source), a.id).toBe(true);
        }
      }
    });

    it('AI・セキュリティの記事はそのタブのタグを1つ以上持つ', () => {
      for (const a of articles) {
        if (a.category === 'general') continue;
        const tabTags: readonly string[] = CATEGORY_TAGS[a.category];
        expect(
          a.tags.some((t) => tabTags.includes(t)),
          a.id,
        ).toBe(true);
      }
    });
  });

  describe('events.json', () => {
    it('20件以上ある', () => {
      expect(events.length).toBeGreaterThanOrEqual(20);
    });

    it('全種別・全形式・全取得元を網羅する', () => {
      expect(new Set(events.map((e) => e.type))).toEqual(new Set(EVENT_TYPE_IDS));
      expect(new Set(events.map((e) => e.format))).toEqual(new Set(EVENT_FORMAT_IDS));
      expect(new Set(events.map((e) => e.source))).toEqual(new Set(EVENT_SOURCE_IDS));
      for (const type of EVENT_TYPE_IDS) {
        const formats = new Set(events.filter((e) => e.type === type).map((e) => e.format));
        expect(formats, type).toEqual(new Set(EVENT_FORMAT_IDS));
      }
    });

    it('東京開催（offline・hybrid）は会場を持つ', () => {
      for (const e of events.filter((e) => e.format !== 'online')) {
        expect(e.venue, e.id).toBeDefined();
      }
    });
  });

  describe('sources.json', () => {
    it('日英・全カテゴリの情報源がある', () => {
      expect(new Set(sources.map((s) => s.lang))).toEqual(new Set(['ja', 'en']));
      expect(new Set(sources.map((s) => s.defaultCategory))).toEqual(new Set(CATEGORY_IDS));
    });
  });
});
