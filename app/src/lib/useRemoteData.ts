import { useCallback, useEffect, useState } from 'react';

export type LoadState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: T };

/** `app/public/data/` 以下のファイルの URL */
export function dataUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}data/${fileName}`;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal, cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as unknown;
}

/**
 * JSON を取得し、`parse` で検証してから返す。
 * `parse` は再描画のたびに作り直さないよう、モジュールの外側で定義した関数を渡す。
 */
export function useRemoteData<T>(
  url: string,
  parse: (input: unknown) => T,
): { state: LoadState<T>; reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson(url, controller.signal)
      .then(parse)
      .then(
        (data) => {
          if (!controller.signal.aborted) setState({ status: 'success', data });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        },
      );
    return () => controller.abort();
  }, [url, parse, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
