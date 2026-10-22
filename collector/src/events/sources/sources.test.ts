import { describe, expect, it, vi } from 'vitest';
import { fetchConnpass, searchMonths, searchUrl } from './connpass';
import type { ConnpassEvent } from './connpass';
import { DOORKEEPER_MAX_PAGES, fetchDoorkeeper, pageUrl } from './doorkeeper';
import { parseManualEvents } from './manual';
import { OFFICIAL_SITES, cleanOfficialTitle, extractLdEvents, fetchOfficialSite } from './official';
import { parseTechplayFeed } from './techplay';
import type { GetJson } from './types';

const NOW = Date.parse('2026-10-23T12:00:00+09:00');

describe('connpass', () => {
  function connpassEvent(overrides: Partial<ConnpassEvent> = {}): ConnpassEvent {
    return {
      id: 1,
      title: 'LLM 勉強会',
      catch: 'キャッチ',
      description: '<p>説明</p>',
      url: 'https://example.connpass.com/event/1/',
      started_at: '2026-11-01T19:00:00+09:00',
      ended_at: '2026-11-01T21:00:00+09:00',
      limit: 30,
      open_status: 'preopen',
      group: { title: 'LLM の会' },
      address: '東京都渋谷区',
      place: 'ABC株式会社',
      owner_display_name: 'owner',
      accepted: 10,
      ...overrides,
    };
  }

  /** 都道府県ごとの検索結果を返す API の代わり */
  function fakeApi(byPrefecture: Record<string, ConnpassEvent[]>) {
    return vi.fn<GetJson>(async (url) => {
      const params = new URL(url).searchParams;
      const all = byPrefecture[params.get('prefecture') ?? ''] ?? [];
      const start = Number(params.get('start'));
      const events = all.slice(start - 1, start - 1 + Number(params.get('count')));
      return Promise.resolve({
        results_available: all.length,
        results_returned: events.length,
        results_start: start,
        events,
      });
    });
  }

  it('今月から3か月分を検索する（日本時間）', () => {
    expect(searchMonths(Date.parse('2026-11-30T15:30:00Z'))).toEqual([
      '202612',
      '202701',
      '202702',
    ]);
    const url = new URL(searchUrl('tokyo', ['202610', '202611'], 101));
    expect(url.searchParams.getAll('ym')).toEqual(['202610', '202611']);
    expect(url.searchParams.get('prefecture')).toBe('tokyo');
    expect(url.searchParams.get('start')).toBe('101');
  });

  it('API キーを付けて東京とオンラインを検索し、形式を決める', async () => {
    const getJson = fakeApi({
      tokyo: [connpassEvent({ id: 1 }), connpassEvent({ id: 3, title: 'ハイブリッド' })],
      online: [
        connpassEvent({ id: 2, place: 'オンライン', address: null }),
        connpassEvent({ id: 3, title: 'ハイブリッド' }),
      ],
    });
    const { candidates } = await fetchConnpass({ apiKey: 'KEY', getJson, now: NOW });

    expect(getJson).toHaveBeenCalledWith(expect.stringContaining('prefecture=tokyo'), {
      'X-API-Key': 'KEY',
    });
    expect(candidates.map((c) => [c.externalId, c.format])).toEqual([
      ['1', 'offline'],
      ['3', 'hybrid'],
      ['2', 'online'],
    ]);
    expect(candidates[0]).toMatchObject({
      source: 'connpass',
      organizer: 'LLM の会',
      capacity: 30,
      accepted: 10,
      description: 'キャッチ\n<p>説明</p>',
    });
  });

  it('全件を取得するまでページをめくる', async () => {
    const many = Array.from({ length: 150 }, (_, i) => connpassEvent({ id: i + 1 }));
    const getJson = fakeApi({ tokyo: many, online: [] });
    const { candidates } = await fetchConnpass({ apiKey: 'KEY', getJson, now: NOW });
    expect(candidates).toHaveLength(150);
    expect(getJson).toHaveBeenCalledTimes(3);
  });

  it('中止のイベントは removedIds に入れ、形式が違う項目は飛ばす', async () => {
    const getJson = fakeApi({
      tokyo: [connpassEvent({ id: 1, open_status: 'cancelled' }), connpassEvent({ id: 2 })],
      online: [{ id: 'x' } as unknown as ConnpassEvent],
    });
    const result = await fetchConnpass({ apiKey: 'KEY', getJson, now: NOW });
    expect(result.removedIds).toEqual(['connpass-1']);
    expect(result.candidates.map((c) => c.externalId)).toEqual(['2']);
  });
});

describe('doorkeeper', () => {
  const item = (id: number, overrides: Record<string, unknown> = {}) => ({
    event: {
      title: `AI 勉強会 ${id}`,
      id,
      starts_at: '2026-11-01T10:00:00.000Z',
      ends_at: '2026-11-01T12:00:00.000Z',
      venue_name: null,
      address: null,
      ticket_limit: 20,
      participants: 5,
      description: '<p>説明</p>',
      public_url: `https://example.doorkeeper.jp/events/${id}`,
      group: { id: 1, name: 'AI の会' },
      ...overrides,
    },
  });

  it('今日から90日分を開催日順に取得する', () => {
    const url = new URL(pageUrl(NOW, 2));
    expect(url.searchParams.get('since')).toBe('2026-10-23');
    expect(url.searchParams.get('until')).toBe('2027-01-21');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('25件未満のページまでめくり、候補にする', async () => {
    const pages = [Array.from({ length: 25 }, (_, i) => item(i + 1)), [item(26)]];
    const getJson = vi.fn<GetJson>(async (url) =>
      Promise.resolve(pages[Number(new URL(url).searchParams.get('page')) - 1] ?? []),
    );
    const { candidates } = await fetchDoorkeeper({ getJson, now: NOW });
    expect(getJson).toHaveBeenCalledTimes(2);
    expect(candidates).toHaveLength(26);
    expect(candidates[0]).toEqual({
      source: 'doorkeeper',
      externalId: '1',
      title: 'AI 勉強会 1',
      url: 'https://example.doorkeeper.jp/events/1',
      startAt: '2026-11-01T10:00:00.000Z',
      endAt: '2026-11-01T12:00:00.000Z',
      venue: undefined,
      address: undefined,
      organizer: 'AI の会',
      capacity: 20,
      accepted: 5,
      description: '<p>説明</p>',
    });
  });

  it('ページ数の上限で止める', async () => {
    const full = Array.from({ length: 25 }, (_, i) => item(i + 1));
    const getJson = vi.fn<GetJson>(async () => Promise.resolve(full));
    await fetchDoorkeeper({ getJson, now: NOW });
    expect(getJson).toHaveBeenCalledTimes(DOORKEEPER_MAX_PAGES);
  });
});

describe('techplay', () => {
  const rss = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:tp="https://rss.techplay.jp/"><channel><title>TECH PLAY</title>
<item>
  <title>生成AI 勉強会 &amp; LT</title>
  <link>https://techplay.jp/event/1001997</link>
  <description>日時:2026/10/29 (木) 16:00〜17:00 会場:オンライン</description>
  <category>IT</category><category>生成AI</category>
  <tp:eventStartTime>2026-10-29 16:00:00</tp:eventStartTime>
  <tp:eventEndTime>2026-10-29 17:00:00</tp:eventEndTime>
  <tp:eventPlace>オンライン</tp:eventPlace>
  <tp:eventAddress></tp:eventAddress>
</item>
<item>
  <title>日時のない項目</title>
  <link>https://techplay.jp/event/2</link>
</item>
</channel></rss>`;

  it('独自の要素から日時・会場を取り出す', () => {
    expect(parseTechplayFeed(rss)).toEqual([
      {
        source: 'techplay',
        externalId: '1001997',
        title: '生成AI 勉強会 &amp; LT',
        url: 'https://techplay.jp/event/1001997',
        startAt: '2026-10-29 16:00:00',
        endAt: '2026-10-29 17:00:00',
        venue: 'オンライン',
        address: undefined,
        description: '日時:2026/10/29 (木) 16:00〜17:00 会場:オンライン',
        keywords: ['IT', '生成AI'],
      },
    ]);
  });

  it('リンクの文字参照を戻す', () => {
    const withQuery = rss.replace(
      'https://techplay.jp/event/1001997<',
      'https://techplay.jp/event/1001997?a=1&amp;b=2<',
    );
    expect(parseTechplayFeed(withQuery)[0]?.url).toBe('https://techplay.jp/event/1001997?a=1&b=2');
  });

  it('RSS でなければ例外を投げる', () => {
    expect(() => parseTechplayFeed('<html><body>error</body></html>')).toThrow();
  });
});

describe('official', () => {
  const site = OFFICIAL_SITES[0]!;
  const html = (ld: string) =>
    `<html><head><script type="application/ld+json">${ld}</script></head></html>`;

  it('JSON-LD の Event を取り出す（配列・@graph の中も見る）', () => {
    const nodes = extractLdEvents(
      html('{"@graph":[{"@type":"WebSite"},{"@type":"ExhibitionEvent","name":"A"}]}') +
        html('[{"@type":"Event","name":"B"}]') +
        html('{壊れた JSON'),
    );
    expect(nodes.map((n) => n.name)).toEqual(['A', 'B']);
  });

  it('公式の題名から本体の名前を取り出す', () => {
    expect(
      cleanOfficialTitle('【公式】NexTech Week 2027 春｜人、企業、世界の「未来」を変える展示会'),
    ).toBe('NexTech Week 2027 春');
  });

  it('東京の展示会を候補にし、東京以外の回は除く', async () => {
    const tokyo = JSON.stringify({
      '@type': 'Event',
      name: '【公式】NexTech Week 2027 春｜展示会',
      startDate: '2027-04-21 10:00',
      endDate: '2027-04-23 17:00',
      location: { '@type': 'Place', name: '東京ビッグサイト/Tokyo Big Sight, Japan' },
      eventAttendanceMode: 'Offline',
      organizer: { '@type': 'Organization', name: 'RX Japan' },
    });
    const makuhari = JSON.stringify({
      '@type': 'Event',
      name: '【公式】Japan IT Week 秋',
      startDate: '2026-10-21 10:00',
      location: { name: '幕張メッセ/Makuhari Messe' },
    });
    const getText = vi.fn(async () => Promise.resolve(html(tokyo) + html(makuhari)));
    const { candidates } = await fetchOfficialSite({ site, getText });

    expect(getText).toHaveBeenCalledWith(site.url);
    expect(candidates).toEqual([
      expect.objectContaining({
        source: 'manual',
        externalId: `official-${site.id}-20270421`,
        title: 'NexTech Week 2027 春',
        url: site.url,
        venue: '東京ビッグサイト/Tokyo Big Sight, Japan',
        organizer: 'RX Japan',
        format: 'offline',
        type: 'expo',
        relevant: true,
      }),
    ]);
  });

  it('Event の JSON-LD がなければ失敗にする', async () => {
    const getText = vi.fn(async () => Promise.resolve('<html></html>'));
    await expect(fetchOfficialSite({ site, getText })).rejects.toThrow('JSON-LD');
  });
});

describe('manual', () => {
  const valid = {
    id: 'manual-interop-2027',
    title: 'Interop Tokyo 2027',
    url: 'https://www.interop.jp/',
    type: 'expo',
    format: 'offline',
    startAt: '2027-06-09T10:00:00+09:00',
    venue: '幕張メッセ',
    tags: ['sec-cloud'],
  };

  it('正しいイベントを読み、source を manual にする', () => {
    expect(parseManualEvents({ events: [valid] })).toEqual({
      events: [{ ...valid, source: 'manual' }],
      errors: [],
    });
  });

  it('不正なイベントは理由を返して飛ばし、他は読む', () => {
    const { events, errors } = parseManualEvents({
      events: [
        valid,
        { ...valid, id: 'interop' },
        { ...valid, id: 'manual-official-x' },
        { ...valid, id: 'manual-typo', tittle: 'x' },
        { ...valid, id: 'manual-bad-date', startAt: '2027-06-09' },
        valid,
      ],
    });
    expect(events).toHaveLength(1);
    expect(errors).toHaveLength(5);
    expect(errors[4]).toContain('重複');
  });

  it('ファイルの形式が違えばエラーにする', () => {
    expect(parseManualEvents([]).errors).toHaveLength(1);
  });
});
