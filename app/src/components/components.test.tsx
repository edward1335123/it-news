import type { Article, TechEvent } from '@itnews/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ArticleCard } from './ArticleCard';
import { ChipBar } from './ChipBar';
import { EventCard } from './EventCard';
import { EmptyView, ErrorView, LoadingView } from './StatusView';
import { TabBar } from './TabBar';

const article: Article = {
  id: 'a1',
  title: 'Claude Code の新機能',
  url: 'https://example.com/a1',
  source: 'zenn',
  lang: 'ja',
  publishedAt: '2026-10-22T09:00:00+09:00',
  category: 'ai',
  tags: ['ai-dev', 'ai-agent'],
  score: 90,
  related: [
    { source: 'hacker-news', url: 'https://example.com/r1' },
    { source: 'publickey', url: 'https://example.com/r2' },
  ],
};

describe('ArticleCard', () => {
  const now = new Date('2026-10-22T12:00:00+09:00');

  it('タイトル・情報源・相対時刻・タグ・注目度・関連件数を表示する', () => {
    render(<ArticleCard article={article} sourceName="Zenn" now={now} />);
    const link = screen.getByRole('link', { name: 'Claude Code の新機能' });
    expect(link).toHaveAttribute('href', 'https://example.com/a1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Zenn')).toBeInTheDocument();
    expect(screen.getByText('3時間前')).toHaveAttribute('datetime', article.publishedAt);
    const tags = within(screen.getByRole('list', { name: 'タグ' })).getAllByRole('listitem');
    expect(tags.map((t) => t.textContent)).toEqual(['AI駆動開発', 'AIエージェント']);
    expect(screen.getByLabelText('注目度 90（注目）')).toBeInTheDocument();
    expect(screen.getByText('他2件の報道')).toBeInTheDocument();
  });

  it('関連報道がなければ件数を出さず、注目度が低ければ強調しない', () => {
    render(
      <ArticleCard article={{ ...article, related: [], score: 20 }} sourceName="Zenn" now={now} />,
    );
    expect(screen.queryByText(/件の報道/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('注目度 20')).toHaveTextContent('20');
  });

  it('タイトルの HTML をエスケープして表示する', () => {
    const title = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <ArticleCard article={{ ...article, title }} sourceName="Zenn" now={now} />,
    );
    expect(screen.getByRole('link', { name: title })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('EventCard', () => {
  const event: TechEvent = {
    id: 'e1',
    title: 'AI エージェント勉強会',
    url: 'https://example.com/e1',
    source: 'connpass',
    type: 'meetup',
    format: 'hybrid',
    startAt: '2026-10-28T19:00:00+09:00',
    endAt: '2026-10-28T21:00:00+09:00',
    venue: '渋谷某所',
    organizer: 'AI Agents Tokyo',
    capacity: 80,
    accepted: 96,
    tags: ['ai-agent'],
  };

  it('日時・種別・形式・場所・主催・参加人数を表示する', () => {
    render(<EventCard event={event} />);
    expect(screen.getByRole('link', { name: 'AI エージェント勉強会' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByText('10/28(水) 19:00〜21:00')).toBeInTheDocument();
    expect(screen.getByText('勉強会')).toBeInTheDocument();
    expect(screen.getByText('ハイブリッド')).toBeInTheDocument();
    expect(screen.getByText('渋谷某所')).toBeInTheDocument();
    expect(screen.getByText('AI Agents Tokyo')).toBeInTheDocument();
    expect(screen.getByText('96/80人（定員超過）')).toBeInTheDocument();
    expect(screen.getByText('connpass')).toBeInTheDocument();
  });

  it('オンライン開催は場所を「オンライン」とし、不明な項目は出さない', () => {
    const online: TechEvent = {
      id: 'e2',
      title: 'オンライン勉強会',
      url: 'https://example.com/e2',
      source: 'doorkeeper',
      type: 'meetup',
      format: 'online',
      startAt: '2026-10-28T19:00:00+09:00',
      tags: [],
    };
    render(<EventCard event={online} />);
    expect(screen.getAllByText('オンライン')).toHaveLength(2); // 形式のバッジと場所
    expect(screen.queryByText('主催')).not.toBeInTheDocument();
    expect(screen.queryByText('参加')).not.toBeInTheDocument();
  });
});

describe('ChipBar', () => {
  it('選択中のチップを示し、押すと選択を通知する', async () => {
    const onSelect = vi.fn();
    render(<ChipBar tags={['ai-dev', 'ai-oss']} selected="ai-dev" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'AI駆動開発' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'ローカルLLM/OSS' }));
    await userEvent.click(screen.getByRole('button', { name: 'すべて' }));
    expect(onSelect.mock.calls).toEqual([['ai-oss'], [null]]);
  });
});

describe('TabBar', () => {
  it('4つのタブを表示し、選択中のタブを示す', async () => {
    const onChange = vi.fn();
    render(<TabBar current="events" onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['AI', 'セキュリティ', 'イベント', '保存']);
    expect(screen.getByRole('tab', { name: 'イベント' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: '保存' }));
    expect(onChange).toHaveBeenCalledWith('saved');
  });
});

describe('StatusView', () => {
  it('読み込み中を status として通知する', () => {
    render(<LoadingView label="記事を読み込み中" />);
    expect(screen.getByRole('status')).toHaveTextContent('記事を読み込み中…');
  });

  it('エラーと再読み込みボタンを表示する', async () => {
    const onRetry = vi.fn();
    render(<ErrorView message="読み込めませんでした" detail="HTTP 500" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('読み込めませんでした');
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('空の状態にメッセージと補足を表示する', () => {
    render(<EmptyView message="記事はありません" hint="別のサブカテゴリを選んでください" />);
    expect(screen.getByText('記事はありません')).toBeInTheDocument();
    expect(screen.getByText('別のサブカテゴリを選んでください')).toBeInTheDocument();
  });
});
