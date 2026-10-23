import type { Article, TechEvent } from '@itnews/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ArticleCard, CARD_MAX_TAGS, HOT_SCORE } from './ArticleCard';
import { ChipBar } from './ChipBar';
import { EventCard } from './EventCard';
import { LangSwitch } from './LangSwitch';
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
  const defaults = {
    sourceName: 'Zenn',
    now,
    read: false,
    saved: { favorite: false, later: false },
    onOpen: () => undefined,
    onToggleSaved: () => undefined,
  };

  it('タイトル・情報源・相対時刻・タグ・注目バッジ・関連件数を表示する', () => {
    render(<ArticleCard {...defaults} article={article} />);
    const link = screen.getByRole('link', { name: 'Claude Code の新機能' });
    expect(link).toHaveAttribute('href', 'https://example.com/a1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Zenn')).toBeInTheDocument();
    expect(screen.getByText('3時間前')).toHaveAttribute('datetime', article.publishedAt);
    const tags = within(screen.getByRole('list', { name: 'タグ' })).getAllByRole('listitem');
    expect(tags.map((t) => t.textContent)).toEqual(['AI駆動開発', 'AIエージェント']);
    expect(screen.getByText('注目')).toBeInTheDocument();
    // 注目度の数字は出さない
    expect(screen.queryByText('90')).not.toBeInTheDocument();
    expect(screen.getByText('他2件の報道')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(article.title);
  });

  it('関連報道がなければ件数を出さず、注目度がしきい値未満なら注目バッジを出さない', () => {
    render(
      <ArticleCard {...defaults} article={{ ...article, related: [], score: HOT_SCORE - 1 }} />,
    );
    expect(screen.queryByText(/件の報道/)).not.toBeInTheDocument();
    expect(screen.queryByText('注目')).not.toBeInTheDocument();
  });

  it('注目度がしきい値ちょうどなら注目バッジを出す', () => {
    render(<ArticleCard {...defaults} article={{ ...article, score: HOT_SCORE }} />);
    expect(screen.getByText('注目')).toBeInTheDocument();
  });

  it('英語の記事にだけ EN のラベルを付ける', () => {
    const { unmount } = render(<ArticleCard {...defaults} article={article} />);
    expect(screen.queryByText('EN')).not.toBeInTheDocument();
    unmount();
    render(<ArticleCard {...defaults} article={{ ...article, lang: 'en', title: 'New model' }} />);
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New model' })).toHaveAttribute('lang', 'en');
  });

  it('タグは最大2つまで表示する', () => {
    render(
      <ArticleCard
        {...defaults}
        article={{ ...article, tags: ['ai-dev', 'ai-agent', 'ai-model'] }}
      />,
    );
    const tags = within(screen.getByRole('list', { name: 'タグ' })).getAllByRole('listitem');
    expect(tags).toHaveLength(CARD_MAX_TAGS);
    expect(tags.map((t) => t.textContent)).toEqual(['AI駆動開発', 'AIエージェント']);
  });

  it('タイトルの見出しレベルを指定できる', () => {
    render(<ArticleCard {...defaults} article={article} titleLevel={3} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(article.title);
  });

  it('タイトルの HTML をエスケープして表示する', () => {
    const title = '<img src=x onerror=alert(1)>';
    const { container } = render(<ArticleCard {...defaults} article={{ ...article, title }} />);
    expect(screen.getByRole('link', { name: title })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('既読を示し、開くと onOpen、保存のボタンで onToggleSaved を呼ぶ', async () => {
    const onOpen = vi.fn();
    const onToggleSaved = vi.fn();
    const { container } = render(
      <ArticleCard
        {...defaults}
        article={article}
        read
        saved={{ favorite: true, later: false }}
        onOpen={onOpen}
        onToggleSaved={onToggleSaved}
      />,
    );
    expect(container.querySelector('.card--read')).not.toBeNull();
    expect(screen.getByText('既読')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'お気に入り' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '後で読む' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const link = screen.getByRole('link', { name: 'Claude Code の新機能' });
    // jsdom はページ遷移できないので、既定の動作を止めてからクリックする
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(onOpen).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'お気に入り' }));
    await userEvent.click(screen.getByRole('button', { name: '後で読む' }));
    expect(onToggleSaved.mock.calls).toEqual([['favorite'], ['later']]);
  });

  it('未読なら既読の表示を出さない', () => {
    render(<ArticleCard {...defaults} article={article} />);
    expect(screen.queryByText('既読')).not.toBeInTheDocument();
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
    render(<EventCard event={event} onAddToCalendar={() => undefined} />);
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
    render(<EventCard event={online} onAddToCalendar={() => undefined} />);
    expect(screen.getAllByText('オンライン')).toHaveLength(2); // 形式のバッジと場所
    expect(screen.queryByText('主催')).not.toBeInTheDocument();
    expect(screen.queryByText('参加')).not.toBeInTheDocument();
  });

  it('「カレンダーに追加」で onAddToCalendar を呼ぶ', async () => {
    const onAddToCalendar = vi.fn();
    render(<EventCard event={event} onAddToCalendar={onAddToCalendar} />);
    await userEvent.click(screen.getByRole('button', { name: 'カレンダーに追加' }));
    expect(onAddToCalendar).toHaveBeenCalledOnce();
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
    render(<TabBar current="events" onChange={onChange} panelVisible />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['AI', 'セキュリティ', 'イベント', '保存']);
    expect(screen.getByRole('tab', { name: 'イベント' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: '保存' }));
    expect(onChange).toHaveBeenCalledWith('saved');
  });

  it('選択中のタブだけがパネルを指し、Tab キーで止まる', () => {
    const { rerender } = render(<TabBar current="ai" onChange={() => undefined} panelVisible />);
    const ai = screen.getByRole('tab', { name: 'AI' });
    const saved = screen.getByRole('tab', { name: '保存' });
    expect(ai).toHaveAttribute('aria-controls', 'panel-ai');
    expect(ai).toHaveAttribute('tabindex', '0');
    expect(saved).not.toHaveAttribute('aria-controls');
    expect(saved).toHaveAttribute('tabindex', '-1');

    // 検索・設定を開いている間はパネルがないので指さない
    rerender(<TabBar current="ai" onChange={() => undefined} panelVisible={false} />);
    expect(ai).not.toHaveAttribute('aria-controls');
  });

  it('矢印キー・Home・End でタブを移る', async () => {
    const onChange = vi.fn();
    render(<TabBar current="ai" onChange={onChange} panelVisible />);
    screen.getByRole('tab', { name: 'AI' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{End}');
    await userEvent.keyboard('{Home}');
    expect(onChange.mock.calls).toEqual([['security'], ['saved'], ['saved'], ['ai']]);
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

describe('LangSwitch', () => {
  it('選んでいる言語を示し、押すと onChange を呼ぶ', async () => {
    const onChange = vi.fn();
    render(<LangSwitch value="all" onChange={onChange} />);
    const group = screen.getByRole('group', { name: '表示する言語' });
    expect(within(group).getByRole('button', { name: '日本語＋英語' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: '日本語のみ' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(within(group).getByRole('button', { name: '日本語のみ' }));
    expect(onChange).toHaveBeenCalledWith('ja');
  });
});
