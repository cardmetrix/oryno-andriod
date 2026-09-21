import { useCallback, useRef, useState } from 'react';

/** User-initiated pull-to-refresh only — never ties RefreshControl to background fetches. */
export function usePullRefresh(refresh: () => Promise<unknown> | void) {
  const [pulling, setPulling] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refreshRef.current();
    } finally {
      setPulling(false);
    }
  }, []);

  return { pulling, onRefresh };
}
