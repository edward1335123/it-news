/**
 * robots.txt（RFC 9309）の最小限の実装。
 * 自分の製品トークンに一致するグループ、なければ `*` のグループの Allow/Disallow を使う。
 */

export type RobotsRules = {
  allow: string[];
  disallow: string[];
};

export const ALLOW_ALL: RobotsRules = { allow: [], disallow: [] };

type Group = { agents: string[]; rules: RobotsRules };

export function parseRobots(text: string, productToken: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | undefined;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (match === null) continue;
    const key = (match[1] ?? '').toLowerCase();
    const value = (match[2] ?? '').trim();

    if (key === 'user-agent') {
      // 連続した User-agent 行は同じグループにまとめる
      if (current === undefined || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current === undefined || value === '') continue;
    if (key === 'allow') current.rules.allow.push(value);
    if (key === 'disallow') current.rules.disallow.push(value);
  }

  const token = productToken.toLowerCase();
  const pick = (agent: string) => groups.filter((g) => g.agents.includes(agent));
  const matched = pick(token).length > 0 ? pick(token) : pick('*');
  return {
    allow: matched.flatMap((g) => g.rules.allow),
    disallow: matched.flatMap((g) => g.rules.disallow),
  };
}

/** パターンが一致したときの長さ（一致しなければ -1）。`*` と末尾の `$` に対応する */
function matchLength(pattern: string, path: string): number {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path) ? body.length : -1;
}

/** パス（クエリを含む）を取得してよいか。最も長く一致した規則に従い、同じ長さなら Allow を優先する */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  const longest = (patterns: string[]) =>
    Math.max(-1, ...patterns.map((p) => matchLength(p, path)));
  return longest(rules.allow) >= longest(rules.disallow);
}
