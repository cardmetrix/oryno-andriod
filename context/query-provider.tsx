import { useAuth } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  createAppQueryClient,
  restoreQueryCache,
  subscribeQueryCachePersist,
} from '@/lib/query-client';

const QueryHydratedContext = createContext(false);

export function useQueryHydrated() {
  return useContext(QueryHydratedContext);
}

/**
 * Restores React Query cache from disk. Does not own the splash —
 * BootGate keeps SplashLoading up until dashboard data is ready.
 */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void restoreQueryCache(queryClient).finally(() => {
      if (cancelled) return;
      setHydrated(true);
      unsubscribe = subscribeQueryCachePersist(queryClient);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <QueryHydratedContext.Provider value={hydrated}>
        {children}
      </QueryHydratedContext.Provider>
    </QueryClientProvider>
  );
}
