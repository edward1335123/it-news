import {
  CATEGORY_TAGS,
  EVENT_FORMATS,
  EVENT_TYPES,
  TAGS,
  eventsFileSchema,
  newsFileSchema,
} from '@itnews/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import eventsJson from '../public/data/events.json';
import newsJson from '../public/data/news.json';
import sourcesJson from '../public/data/sources.json';
import { App } from './App';
import { normalizeText } from './lib/filter';
import { storageKey } from './lib/storage';
import { INVALID_DATA_MESSAGE } from './lib/useRemoteData';
import { stubObjectUrl } from './test/stubObjectUrl';

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

/** 表示中の記事・イベントのカード */
function cards(): HTMLElement[] {
  return within(screen.getByRole('main')).queryAllByRole('article');
}

/** 表示中の記事・イベントのタイトル */
function cardTitles(): string[] {
  return cards().map((card) => within(card).getByRole('link').textContent);
}

function cardByTitle(title: string): HTMLElement {
  const card = cards().find((c) => within(c).getByRole('link').textContent === title);
  if (card === undefined) throw new Error(`カードがありません: ${title}`);
  return card;
}

const byNewest = (a: { publishedAt: string }, b: { publishedAt: string }) =>
  Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

function expectedArticleTitles(tags: readonly string[]): string[] {
  return articles
    .filter((a) => a.tags.some((t) => tags.includes(t)))
    .sort(byNewest)
    .map((a) => a.title);
}

/** jsdom はリンク先へ移動できないので、記事を開く操作は既定の動作を止める */
function preventNavigation(e: MouseEvent) {
  if (e.target instanceof Element && e.target.closest('a[href]')) e.preventDefault();
}

/** テストの基準日時。モックのイベントがすべて開催前になる日にする */
const NOW = new Date('2026-10-22T12:00:00+09:00');

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    // userEvent が使うタイマーは動かしたまま、日時だけ固定する
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    stubFetch();
    document.addEventListener('click', preventNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', preventNavigation);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('保存タブは何も保存していなければ空の状態を表示する', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: '保存' }));
    expect(screen.getByRole('tab', { name: '保存' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('お気に入りはありません')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^後で読む/ }));
    expect(screen.getByText('後で読むはありません')).toBeInTheDocument();
  });

  it('ヘッダーから検索・設定を開き、戻れる', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '検索' }));
    expect(screen.getByRole('heading', { level: 1, name: '検索' })).toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
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

  describe('端末内に保存する状態', () => {
    it('お気に入り・後で読むに追加すると保存タブに出て、再読み込みしても残る', async () => {
      const [first, second] = expectedArticleTitles(CATEGORY_TAGS.ai);
      if (first === undefined || second === undefined) throw new Error('記事が足りません');
      const user = userEvent.setup();
      const { unmount } = render(<App />);
      await screen.findAllByRole('article');
      await user.click(within(cardByTitle(first)).getByRole('button', { name: 'お気に入り' }));
      await user.click(within(cardByTitle(second)).getByRole('button', { name: 'お気に入り' }));
      await user.click(within(cardByTitle(second)).getByRole('button', { name: '後で読む' }));
      expect(
        within(cardByTitle(first)).getByRole('button', { name: 'お気に入り' }),
      ).toHaveAttribute('aria-pressed', 'true');

      unmount();
      render(<App />);
      await user.click(screen.getByRole('tab', { name: '保存' }));
      // 新しく保存したものを上に出す
      expect(cardTitles()).toEqual([second, first]);
      expect(screen.getByRole('button', { name: 'お気に入り 2' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await user.click(screen.getByRole('button', { name: '後で読む 1' }));
      expect(cardTitles()).toEqual([second]);

      // 保存タブで外すと一覧から消える
      await user.click(within(cardByTitle(second)).getByRole('button', { name: '後で読む' }));
      expect(screen.getByText('後で読むはありません')).toBeInTheDocument();
    });

    it('記事を開くと既読になり、未読のみ表示で隠れる。再読み込みしても残る', async () => {
      const [first] = expectedArticleTitles(CATEGORY_TAGS.ai);
      if (first === undefined) throw new Error('記事がありません');
      const user = userEvent.setup();
      const { unmount } = render(<App />);
      await screen.findAllByRole('article');
      expect(within(cardByTitle(first)).queryByText('既読')).not.toBeInTheDocument();

      await user.click(within(cardByTitle(first)).getByRole('link'));
      expect(within(cardByTitle(first)).getByText('既読')).toBeInTheDocument();

      await user.click(screen.getByRole('switch', { name: '未読のみ' }));
      expect(cardTitles()).not.toContain(first);
      expect(cardTitles()).toHaveLength(expectedArticleTitles(CATEGORY_TAGS.ai).length - 1);

      unmount();
      render(<App />);
      await screen.findAllByRole('article');
      expect(screen.getByRole('switch', { name: '未読のみ' })).toBeChecked();
      expect(cardTitles()).not.toContain(first);

      await user.click(screen.getByRole('switch', { name: '未読のみ' }));
      expect(within(cardByTitle(first)).getByText('既読')).toBeInTheDocument();
    });

    it('保存した値が壊れていても既定の状態で起動する', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      localStorage.setItem(storageKey('saved'), '{broken');
      localStorage.setItem(storageKey('prefs'), '"not an object"');
      localStorage.setItem(storageKey('read'), '[1, 2]');
      const user = userEvent.setup();
      render(<App />);
      expect(await screen.findAllByRole('article')).not.toHaveLength(0);
      expect(screen.getByRole('switch', { name: '未読のみ' })).not.toBeChecked();
      await user.click(screen.getByRole('tab', { name: '保存' }));
      expect(screen.getByText('お気に入りはありません')).toBeInTheDocument();
      expect(warn).toHaveBeenCalled();
    });

    it('localStorage が使えなくても動く', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      const user = userEvent.setup();
      render(<App />);
      await screen.findAllByRole('article');
      const [first] = cardTitles();
      if (first === undefined) throw new Error('記事がありません');
      await user.click(within(cardByTitle(first)).getByRole('button', { name: 'お気に入り' }));
      expect(
        within(cardByTitle(first)).getByRole('button', { name: 'お気に入り' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('検索', () => {
    it('キーワードでタイトル・抜粋から探す（全角でも一致する）', async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findAllByRole('article');
      await user.click(screen.getByRole('button', { name: '検索' }));
      expect(screen.getByText('キーワードを入力してください')).toBeInTheDocument();

      const input = screen.getByRole('searchbox', { name: 'キーワード' });
      await user.type(input, 'Ｃｌａｕｄｅ　Ｃｏｄｅ');
      const expected = articles
        .filter((a) => {
          const text = normalizeText(`${a.title}\n${a.summary ?? ''}`);
          return text.includes('claude') && text.includes('code');
        })
        .sort(byNewest)
        .map((a) => a.title);
      expect(expected.length).toBeGreaterThan(0);
      expect(cardTitles()).toEqual(expected);
      expect(screen.getByText(`${expected.length}件`)).toBeInTheDocument();

      await user.clear(input);
      await user.type(input, 'zzzzzz');
      expect(screen.getByText('一致する記事はありません')).toBeInTheDocument();
    });
  });

  describe('設定', () => {
    it('ミュート語を含む記事を隠し、削除すると戻る。再読み込みしても残る', async () => {
      const muted = articles.filter((a) => /copilot/i.test(`${a.title}\n${a.summary ?? ''}`));
      expect(muted.length).toBeGreaterThan(0);
      const user = userEvent.setup();
      const { unmount } = render(<App />);
      await screen.findAllByRole('article');

      await user.click(screen.getByRole('button', { name: '設定' }));
      const input = screen.getByRole('textbox', { name: 'ミュートする語' });
      await user.type(input, 'ＣＯＰＩＬＯＴ');
      await user.click(screen.getByRole('button', { name: '追加' }));
      expect(input).toHaveValue('');
      const list = screen.getByRole('list', { name: 'ミュート語の一覧' });
      expect(within(list).getByText('ＣＯＰＩＬＯＴ')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '戻る' }));
      for (const a of muted) expect(cardTitles()).not.toContain(a.title);

      unmount();
      render(<App />);
      await screen.findAllByRole('article');
      for (const a of muted) expect(cardTitles()).not.toContain(a.title);

      await user.click(screen.getByRole('button', { name: '設定' }));
      await user.click(screen.getByRole('button', { name: 'ＣＯＰＩＬＯＴ を削除' }));
      expect(screen.getByText('ミュート語はありません')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '戻る' }));
      expect(cardTitles()).toEqual(expectedArticleTitles(CATEGORY_TAGS.ai));
    });

    it('情報源を OFF にするとその記事を隠し、再読み込みしても残る', async () => {
      const zenn = articles.filter((a) => a.source === 'zenn').map((a) => a.title);
      expect(zenn.length).toBeGreaterThan(0);
      const user = userEvent.setup();
      const { unmount } = render(<App />);
      await screen.findAllByRole('article');

      await user.click(screen.getByRole('button', { name: '設定' }));
      const zennSwitch = await screen.findByRole('switch', { name: 'Zenn' });
      expect(zennSwitch).toBeChecked();
      await user.click(zennSwitch);
      expect(zennSwitch).not.toBeChecked();
      await user.click(screen.getByRole('button', { name: '戻る' }));
      for (const title of zenn) expect(cardTitles()).not.toContain(title);

      unmount();
      render(<App />);
      await screen.findAllByRole('article');
      for (const title of zenn) expect(cardTitles()).not.toContain(title);
      await user.click(screen.getByRole('button', { name: '設定' }));
      expect(await screen.findByRole('switch', { name: 'Zenn' })).not.toBeChecked();
    });
  });

  describe('イベント', () => {
    function expectEventTitles(type: string | null, format: string | null) {
      const expected = events
        .filter(
          (e) => (type === null || e.type === type) && (format === null || e.format === format),
        )
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
        .map((e) => e.title);
      expect(expected.length).toBeGreaterThan(0);
      expect(cardTitles()).toEqual(expected);
    }

    it('種別・開催形式で絞り込む', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('tab', { name: 'イベント' }));
      await waitFor(() => {
        expect(cardTitles()).toHaveLength(events.length);
      });
      const typeGroup = screen.getByRole('group', { name: '種別' });
      const formatGroup = screen.getByRole('group', { name: '開催形式' });

      await user.click(within(typeGroup).getByRole('button', { name: EVENT_TYPES.meetup.label }));
      expectEventTitles('meetup', null);
      await user.click(
        within(formatGroup).getByRole('button', { name: EVENT_FORMATS.online.label }),
      );
      expectEventTitles('meetup', 'online');
      await user.click(within(typeGroup).getByRole('button', { name: 'すべて' }));
      expectEventTitles(null, 'online');
      await user.click(within(formatGroup).getByRole('button', { name: 'すべて' }));
      expectEventTitles(null, null);
    });

    it('終了したイベントは表示しない', async () => {
      const later = new Date('2026-10-25T00:00:00+09:00');
      vi.setSystemTime(later);
      const ended = events.filter(
        (e) => e.endAt !== undefined && Date.parse(e.endAt) <= later.getTime(),
      );
      expect(ended.length).toBeGreaterThan(0);
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('tab', { name: 'イベント' }));
      await waitFor(() => {
        expect(cardTitles()).toHaveLength(events.length - ended.length);
      });
      for (const e of ended) expect(cardTitles()).not.toContain(e.title);
    });

    it('「カレンダーに追加」で .ics をダウンロードする', async () => {
      const objectUrl = stubObjectUrl();
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download);
      });
      try {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByRole('tab', { name: 'イベント' }));
        await screen.findAllByRole('article');
        const [first] = cards();
        if (first === undefined) throw new Error('イベントがありません');
        const title = within(first).getByRole('link').textContent;
        const event = events.find((e) => e.title === title);
        if (event === undefined) throw new Error('イベントが見つかりません');

        await user.click(within(first).getByRole('button', { name: 'カレンダーに追加' }));
        expect(downloads).toEqual([`event-${event.id}.ics`]);
        const text = await objectUrl.blobs[0]?.text();
        expect(text).toContain('BEGIN:VEVENT');
        expect(text).toContain(`UID:${event.id}@itnews-pwa`);
      } finally {
        objectUrl.restore();
      }
    });
  });

  describe('最終更新とオフライン', () => {
    function setOnline(online: boolean) {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
      act(() => {
        window.dispatchEvent(new Event(online ? 'online' : 'offline'));
      });
    }

    it('記事とイベントに最終更新時刻を表示する', async () => {
      const user = userEvent.setup();
      vi.setSystemTime(new Date('2026-10-22T15:30:00+09:00'));
      render(<App />);
      await screen.findAllByRole('article');
      expect(screen.getByText(/^最終更新/)).toHaveTextContent(
        '最終更新 2026年10月22日 12:00（3時間前）',
      );

      await user.click(screen.getByRole('tab', { name: 'イベント' }));
      expect(screen.getByText(/^最終更新/).querySelector('time')).toHaveAttribute(
        'datetime',
        eventsFileSchema.parse(eventsJson).generatedAt,
      );
    });

    it('オフラインになると帯を出し、表示中のデータは残す。戻ると帯を消す', async () => {
      render(<App />);
      await screen.findAllByRole('article');
      expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument();

      setOnline(false);
      expect(screen.getByRole('status')).toHaveTextContent(
        'オフラインです。前回取得したデータを表示しています',
      );
      expect(cardTitles()).toEqual(expectedArticleTitles(CATEGORY_TAGS.ai));

      setOnline(true);
      expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument();
    });

    it('オフラインで起動したときも帯を出す', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      render(<App />);
      await screen.findAllByRole('article');
      expect(screen.getByText(/オフラインです/)).toBeInTheDocument();
    });
  });
});
