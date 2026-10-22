/** 読み込み中・エラー・空の状態の表示 */

export function LoadingView({ label = '読み込み中' }: { label?: string }) {
  return (
    <div className="status" role="status" aria-live="polite">
      <span className="status__spinner" aria-hidden="true" />
      <p className="status__title">{label}…</p>
      <ul className="skeleton" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="skeleton__card" />
        ))}
      </ul>
    </div>
  );
}

type ErrorProps = {
  message: string;
  detail?: string | undefined;
  onRetry: () => void;
};

export function ErrorView({ message, detail, onRetry }: ErrorProps) {
  return (
    <div className="status" role="alert">
      <p className="status__title">{message}</p>
      {detail !== undefined && <p className="status__detail">{detail}</p>}
      <button type="button" className="button" onClick={onRetry}>
        再読み込み
      </button>
    </div>
  );
}

type EmptyProps = {
  message: string;
  hint?: string | undefined;
};

export function EmptyView({ message, hint }: EmptyProps) {
  return (
    <div className="status">
      <p className="status__title">{message}</p>
      {hint !== undefined && <p className="status__detail">{hint}</p>}
    </div>
  );
}
