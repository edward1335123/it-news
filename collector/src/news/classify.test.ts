import { CATEGORY_TAGS } from '@itnews/shared';
import type { TagId } from '@itnews/shared';
import { describe, expect, it } from 'vitest';
import { classify } from './classify';

const ai = { defaultCategory: 'ai' } as const;
const security = { defaultCategory: 'security' } as const;
const general = { defaultCategory: 'general' } as const;

describe('classify', () => {
  it('AI の情報源の記事にキーワードからサブカテゴリを付ける', () => {
    const result = classify(
      {
        title: 'Claude Code で MCP サーバーを使ったエージェント開発',
        summary: 'Ollama でローカルLLMも試す',
      },
      ai,
      {},
    );
    expect(result.category).toBe('ai');
    expect(result.tags).toEqual(['ai-dev', 'ai-agent', 'ai-model', 'ai-oss']);
    expect(result.matchedKeyword).toBe(true);
  });

  it('全角・大文字の違いを無視する', () => {
    expect(classify({ title: 'ＣＯＰＩＬＯＴ の新機能' }, ai, {}).tags).toContain('ai-dev');
  });

  it('英数字の語は単語の一部に一致させない', () => {
    // "ai" は "maintain" に、"gpu" は "gpus-like" ではなく単語として探す
    const result = classify({ title: 'How to maintain legacy systems' }, general, {});
    expect(result).toEqual({ category: 'general', tags: [], matchedKeyword: false });
  });

  it('IT 全般の情報源は、付いたタグからカテゴリを決める', () => {
    expect(classify({ title: '生成AIの導入事例と資金調達' }, general, {})).toMatchObject({
      category: 'ai',
      tags: ['ai-business'],
    });
    expect(
      classify({ title: 'WordPress プラグインに脆弱性、CVE-2026-1234' }, general, {}),
    ).toMatchObject({ category: 'security', tags: ['sec-vuln'] });
    expect(classify({ title: '新しいスマートフォンが発売' }, general, {}).category).toBe('general');
  });

  it('あいまいな語のタグは、その話題の記事にだけ付ける', () => {
    // 「買収」は AI の話題でなければ ai-business にしない
    expect(classify({ title: '大手小売チェーンが同業を買収' }, general, {}).tags).toEqual([]);
    // 「クラウド」はセキュリティの話題でなければ sec-cloud にしない
    expect(classify({ title: 'クラウド料金の見直し方' }, general, {}).tags).toEqual([]);
    expect(classify({ title: 'クラウドの設定ミスで情報漏えい' }, general, {}).tags).toEqual([
      'sec-incident',
      'sec-cloud',
    ]);
  });

  it('AI とセキュリティの両方の話題なら ai-security を付ける', () => {
    const result = classify(
      { title: 'Attackers abuse LLM agents to steal credentials' },
      security,
      {},
    );
    expect(result.category).toBe('security');
    expect(result.tags).toContain('ai-security');
    expect(classify({ title: 'プロンプトインジェクションの対策' }, general, {})).toMatchObject({
      category: 'security',
      tags: ['ai-security'],
    });
  });

  it('タブのタグが付かなければ情報源の代わりのタグを付ける', () => {
    expect(classify({ title: 'Our year in review' }, ai, { fallbackTag: 'ai-research' })).toEqual({
      category: 'ai',
      tags: ['ai-research'],
      matchedKeyword: false,
    });
    expect(classify({ title: 'Weekly roundup' }, ai, {}).tags).toEqual(['ai-business']);
    expect(classify({ title: 'Weekly roundup' }, security, {}).tags).toEqual(['sec-incident']);
  });

  it('常に付けるタグを加える', () => {
    const result = classify({ title: '定例のお知らせ' }, security, {
      alwaysTags: ['sec-advisory'],
    });
    expect(result).toEqual({ category: 'security', tags: ['sec-advisory'], matchedKeyword: false });
  });

  it('AI・セキュリティの記事は必ずそのタブのタグを持つ', () => {
    const titles = ['Hello world', 'ランサムウェア攻撃', 'GPU 不足', '新モデル GPT-6 を発表'];
    for (const source of [ai, security, general]) {
      for (const title of titles) {
        const { category, tags } = classify({ title }, source, {});
        if (category === 'general') continue;
        const tabTags: readonly TagId[] = CATEGORY_TAGS[category];
        expect(
          tags.some((t) => tabTags.includes(t)),
          `${source.defaultCategory}: ${title}`,
        ).toBe(true);
      }
    }
  });
});
