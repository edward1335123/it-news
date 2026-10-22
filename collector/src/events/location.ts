import type { TechEvent } from '@itnews/shared';

/**
 * 東京＋オンラインの絞り込み（SPEC 2章・4.3）。
 * 会場・住所・タイトルから開催形式を推定し、東京でもオンラインでもないイベントは除く。
 */

/** オンライン開催を示す語 */
const ONLINE_WORDS =
  /オンライン|ｵﾝﾗｲﾝ|online|zoom|teams|youtube|google meet|webex|ウェビナー|webinar|web開催|webセミナー|web会議|配信|リモート|remote|virtual|バーチャル/gi;
/** タイトルなどで、会場とオンラインの両方で開催することを示す語 */
const HYBRID_WORDS =
  /ハイブリッド|hybrid|オンライン(?:同時)?配信あり|同時配信|オンライン参加(?:も)?(?:可|OK)|会場\s*[+＋&＆・/／]\s*オンライン|オンライン\s*[+＋&＆・/／]\s*会場/i;

/** 東京都を示す語。区・主な地名と、住所に「東京」を含まない主な会場 */
const TOKYO_WORDS = new RegExp(
  [
    '東京',
    '\\btokyo\\b',
    '(?:千代田|中央|港|新宿|文京|台東|墨田|江東|品川|目黒|大田|世田谷|渋谷|中野|杉並|豊島|北|荒川|板橋|練馬|足立|葛飾|江戸川)区',
    '八王子|立川|武蔵野|三鷹|府中|調布|町田|小金井|国分寺|多摩市',
    '丸の内|大手町|有楽町|日本橋|六本木|赤坂|虎ノ門|汐留|浜松町|田町|五反田|大崎|恵比寿|表参道|秋葉原|御茶ノ水|お茶の水|神田|飯田橋|池袋|銀座|お台場|有明|天王洲|竹芝|高輪',
    'ビッグサイト|big sight',
  ].join('|'),
  'i',
);

/** 東京都以外を示す語。「東京」を含んでも東京都ではない会場（東京ディズニーリゾートなど）を除く */
const OTHER_PLACE_WORDS = new RegExp(
  [
    '北海道',
    '(?:青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)県',
    // 「東京都」の中の「京都」、港区の「浜松町」、杉並区の「大宮」は除く
    '幕張|舞浜|浦安|横浜|川崎|さいたま|(?<!杉並区)大宮|札幌|仙台|名古屋|(?<!東)京都|大阪|梅田|神戸|広島|福岡|博多|那覇|沖縄|金沢|浜松(?!町)',
    '\\b(?:yokohama|makuhari|kawasaki|sapporo|sendai|nagoya|kyoto|osaka|kobe|hiroshima|fukuoka|okinawa)\\b',
  ].join('|'),
  'i',
);

function hasOnlineWord(text: string): boolean {
  ONLINE_WORDS.lastIndex = 0;
  return ONLINE_WORDS.test(text);
}

/** 会場・住所が東京都か */
export function isTokyo(place: string): boolean {
  const text = place.normalize('NFKC');
  return TOKYO_WORDS.test(text) && !OTHER_PLACE_WORDS.test(text);
}

export type PlaceInfo = {
  title: string;
  venue?: string | undefined;
  address?: string | undefined;
};

/**
 * 開催形式を推定する。東京でもオンラインでもなければ null（取り込まない）。
 *
 * - 会場・住所が空か、オンラインを示す語だけなら online。ただし会場が未定でも、タイトルに地名があれば
 *   それに従う（「【神戸開催】」は除き、「【東京開催】」は offline）
 * - 会場が東京で、会場またはタイトルにオンラインでの参加を示す語があれば hybrid、なければ offline
 * - 会場が東京以外でも、オンラインで参加できるなら online（東京の会場には行かないため）
 */
export function detectFormat({ title, venue, address }: PlaceInfo): TechEvent['format'] | null {
  const place = [venue, address]
    .filter((p) => p !== undefined)
    .join(' ')
    .normalize('NFKC');
  const physical = place.replace(ONLINE_WORDS, '').replace(/[\s\p{P}\p{S}]/gu, '') !== '';
  const normalizedTitle = title.normalize('NFKC');
  const online = hasOnlineWord(place) || HYBRID_WORDS.test(normalizedTitle);

  if (!physical) {
    if (hasOnlineWord(normalizedTitle)) return 'online';
    if (OTHER_PLACE_WORDS.test(normalizedTitle)) return null;
    return TOKYO_WORDS.test(normalizedTitle) ? 'offline' : 'online';
  }
  if (isTokyo(place)) return online ? 'hybrid' : 'offline';
  return online ? 'online' : null;
}
