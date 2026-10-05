// 간단한 비동기 로더 훅. dexie-react-hooks 미사용(의존성 최소화).
// refresh()로 수동 재조회.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  // fn은 매 렌더 새로 생성되므로 ref로 보관하고 deps로만 재실행 제어.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((res) => {
        if (mounted.current) setData(res);
      })
      .catch((e: unknown) => {
        if (mounted.current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}
