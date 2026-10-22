import { formatDateTime, formatRelativeTime } from '../lib/format';

/** データの最終更新時刻（収集した時刻 generatedAt） */
export function UpdatedAt({ generatedAt, now }: { generatedAt: string; now: Date }) {
  return (
    <p className="updated-at">
      最終更新 <time dateTime={generatedAt}>{formatDateTime(generatedAt)}</time>（
      {formatRelativeTime(generatedAt, now)}）
    </p>
  );
}

/** オフラインのときに出す帯。データは Service Worker が前回の応答を返す */
export function OfflineBanner({ hasData }: { hasData: boolean }) {
  return (
    <p className="offline-banner" role="status">
      {hasData
        ? 'オフラインです。前回取得したデータを表示しています'
        : 'オフラインです。通信できるようになってから再読み込みしてください'}
    </p>
  );
}
