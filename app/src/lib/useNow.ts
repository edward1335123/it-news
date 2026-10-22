import { useEffect, useState } from 'react';

/**
 * 相対時刻・終了したイベントの判定に使う現在時刻。
 * ホーム画面のアプリは閉じずに復帰することが多いので、画面に戻ったときに更新する。
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return now;
}
