import { useCallback, useState } from 'react';

/** User-initiated pull-to-refresh only — never ties RefreshControl to background fetches. */
export function usePullRefresh(refresh: () => Promise<unknown> | void) {
  const [pulling, setPulling] = useState(false);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);

  return { pulling, onRefresh };
}
