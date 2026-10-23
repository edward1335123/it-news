import type { Article } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import { findCvssScore, matchReasons, reasonLabel } from './rules';

const article = (overrides: Partial<Article> = {}): Article => ({
  id: 'a1',
  title: 'タイトル',
  url: 'https://example.com/a1',
  source: 'publickey',
  lang: 'ja',
  publishedAt: '2026-10-23T09:00:00+09:00',
  category: 'security',
  tags: [],
  score: 1,
  related: [],
  ...overrides,
});

describe('findCvssScore', () => {
  it.each([
    ['Two CVSS 9.0 Linux KSMBD RCE Flaws', 9.0],
    ['Critical GitLab Flaw (CVSS 10.0) Could Allow RCE', 10],
    ['深刻度「最大」の脆弱性 CVSS「10.0」', 10],
    ['PHPに関してCVSS v4.0で9.2の重大な脆弱性', 9.2],
    ['CVSSv3.1 base score 9.8', 9.8],
    ['CVSS スコアは 9.8/10', 9.8],
    ['ＣＶＳＳ　９．８', 9.8],
    ['CVSS 7.5 と CVSS 9.1 の2件', 9.1],
  ])('%s → %s', (text, score) => {
    expect(findCvssScore(text)).toBe(score);
  });

  it.each([
    ['CVSS の数字がない記事'],
    ['9.8 の脆弱性（CVSS の表記より前）'],
    ['CVSS について12日に公表'],
    ['CVSS:3.1/AV:N/AC:L'],
  ])('9.0 以上と読まない: %s', (text) => {
    const score = findCvssScore(text);
    expect(score === undefined || score < 9).toBe(true);
  });
});

describe('matchReasons', () => {
  it('CISA KEV の記事は KEV への追加として通知する', () => {
    expect(matchReasons(article({ source: 'cisa-kev' }), [])).toEqual([{ kind: 'kev' }]);
  });

  it('JPCERT は注意喚起だけを通知し、Weekly Report は通知しない', () => {
    const alert = article({ source: 'jpcert', title: '注意喚起: PHPにおける複数の脆弱性' });
    const weekly = article({ source: 'jpcert', title: 'Weekly Report: Edgeに複数の脆弱性' });
    expect(matchReasons(alert, [])).toEqual([{ kind: 'jpcert' }]);
    expect(matchReasons(weekly, [])).toEqual([]);
  });

  it('CVSS 9.0 以上は通知し、9.0 未満は通知しない', () => {
    expect(matchReasons(article({ title: 'Flaw (CVSS 9.0)' }), [])).toEqual([
      { kind: 'cvss', score: 9 },
    ]);
    expect(matchReasons(article({ title: 'Flaw (CVSS 8.9)' }), [])).toEqual([]);
  });

  it('抜粋の CVSS も見る', () => {
    expect(matchReasons(article({ summary: 'CVSS 9.8 の脆弱性' }), [])).toEqual([
      { kind: 'cvss', score: 9.8 },
    ]);
  });

  it('注目キーワードは全角・半角や大文字・小文字の違いを無視して照合する', () => {
    const a = article({ title: 'ＣＬＡＵＤＥ　Code の新機能' });
    expect(matchReasons(a, ['claude code'])).toEqual([{ kind: 'keyword', keyword: 'claude code' }]);
    expect(matchReasons(a, ['Cursor', '  '])).toEqual([]);
  });

  it('複数当てはまるときは優先度の高い順に並べる', () => {
    const a = article({ source: 'cisa-kev', title: 'Fortinet CVSS 9.8' });
    expect(matchReasons(a, ['fortinet']).map((r) => r.kind)).toEqual(['kev', 'cvss', 'keyword']);
  });
});

describe('reasonLabel', () => {
  it('理由ごとの見出しを返す', () => {
    expect(reasonLabel({ kind: 'kev' })).toBe('CISA KEV に追加');
    expect(reasonLabel({ kind: 'jpcert' })).toBe('JPCERT 注意喚起');
    expect(reasonLabel({ kind: 'cvss', score: 10 })).toBe('CVSS 10.0');
    expect(reasonLabel({ kind: 'keyword', keyword: 'MCP' })).toBe('注目キーワード「MCP」');
  });
});
