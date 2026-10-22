/** フィードの文字列を表示用のプレーンテキストに整える。 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  yen: '¥',
  euro: '€',
};

function isValidCodePoint(cp: number): boolean {
  return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
}

/** 文字参照（`&amp;`・`&#8217;`・`&#x2019;`）を文字に戻す。知らない名前はそのまま残す */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const cp = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return isValidCodePoint(cp) ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** HTML のタグ・コメント・script/style の中身を取り除く */
export function stripTags(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, ' ');
}

/**
 * フィードの文字列をプレーンテキストにする。
 * エスケープされた HTML（`&lt;p&gt;`）にも対応するため、タグを除く前後で文字参照を戻す。
 */
export function toPlainText(raw: string): string {
  return decodeEntities(stripTags(decodeEntities(raw)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** `max` 文字（UTF-16 の長さ）以内に切り詰める。切ったときは末尾を「…」にする */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  let head = text.slice(0, max - 1);
  // サロゲートペアの途中で切らない
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  return `${head.trimEnd()}…`;
}
