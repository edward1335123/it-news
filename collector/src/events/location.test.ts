import { describe, expect, it } from 'vitest';
import { detectFormat, isTokyo } from './location';

describe('isTokyo', () => {
  it.each([
    '東京都渋谷区道玄坂1-2-3',
    '東京ビッグサイト/Tokyo Big Sight, Japan',
    '渋谷区神泉町8-16',
    'ベルサール六本木',
    'Shibuya, Tokyo',
    '東京都北区王子',
    '東京都港区浜松町2-4-1 世界貿易センタービル',
    '東京都杉並区大宮2丁目',
  ])('東京: %s', (place) => {
    expect(isTokyo(place)).toBe(true);
  });

  it.each([
    '幕張メッセ/Makuhari Messe',
    '神奈川県横浜市西区みなとみらい',
    '千葉県浦安市舞浜 東京ディズニーリゾート',
    '京都府京都市下京区',
    '大阪市北区梅田',
    '浜松市中区 東京エレクトロン',
    '株式会社メンバーズ',
    '',
  ])('東京以外または不明: %s', (place) => {
    expect(isTokyo(place)).toBe(false);
  });
});

describe('detectFormat', () => {
  it('会場・住所が空ならオンライン', () => {
    expect(detectFormat({ title: 'LLM 勉強会' })).toBe('online');
    expect(detectFormat({ title: 'LLM 勉強会', venue: '', address: '' })).toBe('online');
  });

  it('会場がオンラインを示す語だけならオンライン', () => {
    expect(detectFormat({ title: 'LLM 勉強会', venue: 'オンライン' })).toBe('online');
    expect(detectFormat({ title: 'LLM 勉強会', venue: 'Zoom', address: 'online' })).toBe('online');
    expect(
      detectFormat({ title: 'セミナー', venue: 'Webセミナー（URLは主催企業からお知らせします）' }),
    ).toBe('online');
  });

  it('会場が東京ならオフライン', () => {
    expect(
      detectFormat({ title: 'LLM 勉強会', venue: 'ABC株式会社', address: '東京都港区六本木1-1' }),
    ).toBe('offline');
  });

  it('会場が東京で、オンラインでも参加できればハイブリッド', () => {
    expect(
      detectFormat({ title: 'LLM 勉強会', venue: 'オンライン ABC株式会社', address: '東京都港区' }),
    ).toBe('hybrid');
    expect(
      detectFormat({ title: '【ハイブリッド開催】LLM 勉強会', address: '東京都港区六本木1-1' }),
    ).toBe('hybrid');
    expect(
      detectFormat({ title: 'LLM 勉強会（会場＋オンライン）', address: '東京都千代田区' }),
    ).toBe('hybrid');
  });

  it('東京以外の会場は除く。ただしオンラインでも参加できればオンライン', () => {
    expect(detectFormat({ title: 'LLM 勉強会', venue: '幕張メッセ' })).toBeNull();
    expect(detectFormat({ title: 'LLM 勉強会', address: '大阪府大阪市北区梅田' })).toBeNull();
    expect(
      detectFormat({ title: 'LLM 勉強会', venue: 'オンライン 琉球大学', address: '沖縄県中頭郡' }),
    ).toBe('online');
  });

  it('場所が分からない会場（住所なしの会社名など）は除く', () => {
    expect(detectFormat({ title: 'LLM 勉強会', venue: '株式会社メンバーズ' })).toBeNull();
  });

  it('会場が未定でも、タイトルの地名に従う', () => {
    expect(detectFormat({ title: '【神戸開催】AI勉強会' })).toBeNull();
    expect(detectFormat({ title: '【東京開催】AI勉強会' })).toBe('offline');
    expect(detectFormat({ title: '【オンライン】大阪の AI 事例紹介' })).toBe('online');
  });
});
