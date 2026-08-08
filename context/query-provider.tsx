import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { SplashLoading } from '@/components/ui/splash-loading';
import {
  createAppQueryClient,
  restoreQueryCache,
  subscribeQueryCachePersist,
} from '@/lib/query-client';

/** QueryClient with AsyncStorage persistence. Blocks until disk cache is restored. */
export function AppQueryProvider({ children }: { children: React.ReactNode }) {
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

  if (!hydrated) {
    return <SplashLoading />;
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
