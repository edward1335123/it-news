import { CATEGORY_TAGS, TAGS, eventsFileSchema, newsFileSchema } from '@itnews/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import eventsJson from '../public/data/events.json';
import newsJson from '../public/data/news.json';
import sourcesJson from '../public/data/sources.json';
import { App } from './App';
import { INVALID_DATA_MESSAGE } from './lib/useRemoteData';

const MOCK_FILES: Record<string, unknown> = {
  '/data/news.json': newsJson,
  '/data/events.json': eventsJson,
  '/data/sources.json': sourcesJson,
};

const { articles } = newsFileSchema.parse(newsJson);
const { events } = eventsFileSchema.parse(eventsJson);

/** モックJSONを返す fetch。`failing` に入れた URL は 500 を返す */
function stubFetch(failing: Set<string> = new Set()) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = MOCK_FILES[url];
    if (body === undefined || failing.has(url)) {
      return Promise.resolve(new Response('error', { status: 500 }));
    }
    return Promise.resolve(Response.json(body));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** 表示中の記事・イベントのタイトル */
function cardTitles(): string[] {
  return within(screen.getByRole('tabpanel'))
    .queryAllByRole('article')
    .map((card) => within(card).getByRole('link').textContent);
}

function expectedArticleTitles(tags: readonly string[]): string[] {
  return articles
    .filter((a) => a.tags.some((t) => tags.includes(t)))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .map((a) => a.title);
}

describe('App', () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('読み込み中を表示し、AI タブにモックの記事を表示する', async () => {
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('記事を読み込み中');
    expect(await screen.findAllByRole('article')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'AI' })).toBeInTheDocument();
    expect(cardTitles()).toEqual(expectedArticleTitles(CATEGORY_TAGS.ai));
    // 情報源は sources.json の名前で表示する
    await waitFor(() => {
      expect(screen.getAllByText('Zenn').length).toBeGreaterThan(0);
    });
  });

  it('サブカテゴリのチップで絞り込み、「すべて」で戻す', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByRole('article');

    for (const tag of CATEGORY_TAGS.ai) {
      await user.click(screen.getByRole('button', { name: TAGS[tag].label }));
      const titles = cardTitles();
      expect(titles.length, tag).toBeGreaterThan(0);
      expect(titles, tag).toEqual(expectedArticleTitles([tag]));
    }

    await user.click(screen.getByRole('button', { name: 'すべて' }));
    expect(cardTitles()).toEqual(expectedArticleTitles(CATEGORY_TAGS.ai));
  });

  it('セキュリティタブに AI セキュリティの記事も表示し、絞り込みはタブごとに保つ', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: 'AI駆動開発' }));

    await user.click(screen.getByRole('tab', { name: 'セキュリティ' }));
    expect(screen.getByRole('heading', { level: 1, name: 'セキュリティ' })).toBeInTheDocument();
    expect(cardTitles()).toEqual(expectedArticleTitles(CATEGORY_TAGS.security));

    await user.click(screen.getByRole('button', { name: 'AIセキュリティ' }));
    expect(cardTitles()).toEqual(expectedArticleTitles(['ai-security']));

    await user.click(screen.getByRole('tab', { name: 'AI' }));
    expect(screen.getByRole('button', { name: 'AI駆動開発' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(cardTitles()).toEqual(expectedArticleTitles(['ai-dev']));
  });

  it('イベントタブに開催日が近い順でイベントを表示する', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'イベント' }));
    await waitFor(() => {
      expect(cardTitles()).toHaveLength(events.length);
    });
    const expected = [...events]
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
      .map((e) => e.title);
    expect(cardTitles()).toEqual(expected);
  });

  it('保存タブは空の状態を表示する', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: '保存' }));
    expect(screen.getByRole('tab', { name: '保存' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('保存した記事はありません')).toBeInTheDocument();
  });

  it('ヘッダーから検索・設定を開き、戻れる', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '検索' }));
    expect(screen.getByRole('heading', { level: 1, name: '検索' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '戻る' }));
    await user.click(screen.getByRole('button', { name: '設定' }));
    expect(screen.getByRole('heading', { level: 1, name: '設定' })).toBeInTheDocument();
    // タブを押すと設定を閉じてそのタブに移る
    await user.click(screen.getByRole('tab', { name: 'イベント' }));
    expect(screen.getByRole('heading', { level: 1, name: 'イベント' })).toBeInTheDocument();
  });

  it('読み込みに失敗したらエラーを表示し、再読み込みで回復する', async () => {
    const failing = new Set(['/data/news.json']);
    const fetchMock = stubFetch(failing);
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('記事を読み込めませんでした');
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();

    failing.clear();
    await user.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(await screen.findAllByRole('article')).not.toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith('/data/news.json', expect.anything());
  });

  it('スキーマに合わないデータはエラーとして表示し、検証の詳細は画面に出さない', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    MOCK_FILES['/data/events.json'] = { generatedAt: 'invalid', events: [] };
    try {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('tab', { name: 'イベント' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('イベントを読み込めませんでした');
      expect(alert).toHaveTextContent(INVALID_DATA_MESSAGE);
      expect(alert).not.toHaveTextContent('generatedAt');
      expect(consoleError).toHaveBeenCalled();
    } finally {
      MOCK_FILES['/data/events.json'] = eventsJson;
      consoleError.mockRestore();
    }
  });

  it('記事・イベントが0件なら空の状態を表示する', async () => {
    MOCK_FILES['/data/news.json'] = { generatedAt: '2026-10-22T12:00:00+09:00', articles: [] };
    MOCK_FILES['/data/events.json'] = { generatedAt: '2026-10-22T12:00:00+09:00', events: [] };
    try {
      const user = userEvent.setup();
      render(<App />);
      expect(await screen.findByText('記事はありません')).toBeInTheDocument();
      expect(screen.queryByText('別のサブカテゴリを選んでください')).not.toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'イベント' }));
      expect(await screen.findByText('予定されているイベントはありません')).toBeInTheDocument();
    } finally {
      MOCK_FILES['/data/news.json'] = newsJson;
      MOCK_FILES['/data/events.json'] = eventsJson;
    }
  });

  it('絞り込みの結果が0件なら別のサブカテゴリを促す', async () => {
    const devArticle = articles.find((a) => a.tags.length === 1 && a.tags[0] === 'ai-dev');
    expect(devArticle).toBeDefined();
    MOCK_FILES['/data/news.json'] = {
      generatedAt: '2026-10-22T12:00:00+09:00',
      articles: [devArticle],
    };
    try {
      const user = userEvent.setup();
      render(<App />);
      await screen.findAllByRole('article');
      await user.click(screen.getByRole('button', { name: TAGS['ai-model'].label }));
      expect(screen.getByText('記事はありません')).toBeInTheDocument();
      expect(screen.getByText('別のサブカテゴリを選んでください')).toBeInTheDocument();
    } finally {
      MOCK_FILES['/data/news.json'] = newsJson;
    }
  });
});
