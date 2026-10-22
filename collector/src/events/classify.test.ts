import { describe, expect, it } from 'vitest';
import { CONFERENCE_CAPACITY, estimateType, eventTags, isRelevant } from './classify';

describe('estimateType', () => {
  it.each([
    'NexTech Week 2027 春',
    'Japan IT Week 秋',
    'AI・人工知能EXPO',
    'クラウド＆セキュリティ 展示会',
    'UNION EXPO 2026 in 渋谷',
  ])('展示会: %s', (title) => {
    expect(estimateType({ title })).toBe('expo');
  });

  it.each([
    'Developers Summit 2027',
    'JAWS DAYS 2027',
    'PyCon JP 2026',
    'RubyKaigi 2027',
    'CloudNative Days Winter',
    'AI カンファレンス 2026',
    'JJUG CCC 2026 Fall コンファレンス',
    '第33回AIITフォーラム',
    'KUSANAGIサミット2026',
    'ScalaMatsuri Conference',
    'DevFest Tokyo',
  ])('カンファレンス: %s', (title) => {
    expect(estimateType({ title })).toBe('conference');
  });

  it.each(['LLM 勉強会 #12', 'Claude Code もくもく会', 'AI セキュリティ LT 会', 'mitaka.rb'])(
    '勉強会・ミートアップ: %s',
    (title) => {
      expect(estimateType({ title })).toBe('meetup');
    },
  );

  it('定員が大きければカンファレンス', () => {
    expect(estimateType({ title: 'JJUG CCC 2026', capacity: CONFERENCE_CAPACITY })).toBe(
      'conference',
    );
    expect(estimateType({ title: 'JJUG CCC 2026', capacity: CONFERENCE_CAPACITY - 1 })).toBe(
      'meetup',
    );
  });

  it('単語の一部には反応しない', () => {
    expect(estimateType({ title: 'Holidays ハッカソン' })).toBe('meetup');
    expect(estimateType({ title: 'Expose API 入門' })).toBe('meetup');
  });
});

describe('isRelevant', () => {
  it.each([
    { title: 'Claude Code ハンズオン' },
    { title: '生成AI活用セミナー' },
    { title: 'ランサムウェア対策の最前線' },
    { title: 'Kubernetes 入門' },
    { title: 'TypeScript 勉強会' },
    { title: 'エンジニア交流会' },
    { title: '週末の交流会', body: 'Python でデータ分析をします' },
    { title: '交流会', keywords: ['生成AI', 'DX'] },
  ])('IT・AI・セキュリティ関連: $title', (event) => {
    expect(isRelevant(event)).toBe(true);
  });

  it.each([
    { title: 'ロイロノート基本操作研修' },
    { title: '白菜キムチ作りクラス' },
    { title: 'マンダラチャート人生計画セミナー' },
    { title: '第150回 ビーラブ２dayMG研修' },
  ])('関連しない: $title', (event) => {
    expect(isRelevant(event)).toBe(false);
  });

  it('本文の語でも判定する', () => {
    expect(isRelevant({ title: '月例会', body: 'LLM の最新動向を話します' })).toBe(true);
  });
});

describe('eventTags', () => {
  it('ニュースと同じキーワード辞書でタグを付ける', () => {
    expect(eventTags({ title: 'Claude Code で始める AI 駆動開発' })).toContain('ai-dev');
    expect(eventTags({ title: 'MCP サーバーを作ろう' })).toContain('ai-agent');
    expect(eventTags({ title: '脆弱性診断ハンズオン', keywords: ['セキュリティ'] })).toContain(
      'sec-vuln',
    );
  });

  it('関係するタグがなければ空', () => {
    expect(eventTags({ title: 'TypeScript 勉強会' })).toEqual([]);
  });
});
