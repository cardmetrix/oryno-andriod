import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dehydrate,
  hydrate,
  QueryClient,
  type DehydratedState,
} from '@tanstack/react-query';

import { PERSISTABLE_QUERY_ROOTS } from '@/lib/query-keys';

export const STALE = {
  wallet: 60_000,
  notifications: 60_000,
  transactions: 60_000,
  profile: 5 * 60_000,
  ads: 5 * 60_000,
  onboarding: 30 * 60_000,
  catalog: 30 * 60_000,
} as const;

const GC_TIME = 24 * 60 * 60_000;
const PERSIST_KEY = 'oryno-query-cache-v1';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE.wallet,
        gcTime: GC_TIME,
        retry: (count, error) => {
          // One extra attempt for flaky mobile networks.
          if (count >= 2) return false;
          const msg = error instanceof Error ? error.message : '';
          return /network request failed|failed to fetch|timeout/i.test(msg);
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
        networkMode: 'offlineFirst',
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: 'online',
        retry: 0,
      },
    },
  });
}

export function shouldPersistQuery(queryKey: readonly unknown[]) {
  const root = queryKey[0];
  return typeof root === 'string' && PERSISTABLE_QUERY_ROOTS.has(root);
}

function dehydrateForStorage(client: QueryClient): DehydratedState {
  return dehydrate(client, {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && shouldPersistQuery(query.queryKey),
  });
}

export async function restoreQueryCache(client: QueryClient) {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const state = JSON.parse(raw) as DehydratedState;
    hydrate(client, state);
  } catch {
    await AsyncStorage.removeItem(PERSIST_KEY).catch(() => undefined);
  }
}

export function subscribeQueryCachePersist(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void AsyncStorage.setItem(
        PERSIST_KEY,
        JSON.stringify(dehydrateForStorage(client)),
      ).catch(() => undefined);
    }, 1500);
  };

  const unsubscribe = client.getQueryCache().subscribe(persist);
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
