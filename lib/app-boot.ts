import type { QueryClient } from '@tanstack/react-query';

import { fetchAds } from '@/hooks/use-ads';
import { fetchNotifications } from '@/hooks/use-notifications-query';
import { fetchProfile } from '@/hooks/use-profile';
import { fetchWallet } from '@/hooks/use-wallet';
import { waitForApiAuth } from '@/lib/api';
import { syncSessionToDatabase } from '@/lib/auth-sync';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function hasWarmAppCache(queryClient: QueryClient) {
  return Boolean(queryClient.getQueryData(queryKeys.wallet));
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    }
  }
  throw lastError;
}

type GetToken = (opts?: { skipCache?: boolean }) => Promise<string | null | undefined>;

/**
 * Cold start: wait for auth sync + wallet before entering the app.
 * Warm start: enter immediately from disk cache; refresh in background.
 */
export async function bootstrapSignedInSession(options: {
  queryClient: QueryClient;
  getToken: GetToken;
  warm: boolean;
}) {
  const { queryClient, getToken, warm } = options;

  await waitForApiAuth(10_000);

  let token = await getToken(warm ? undefined : { skipCache: true });
  if (!token) {
    await new Promise((r) => setTimeout(r, 200));
    token = await getToken({ skipCache: true });
  }
  if (!token) {
    throw new Error('Missing Clerk session token');
  }

  if (warm) {
    // Background: sync + soft revalidate. Don't block UI.
    void syncSessionToDatabase().catch(() => undefined);
    void queryClient.prefetchQuery({
      queryKey: queryKeys.wallet,
      queryFn: fetchWallet,
      staleTime: STALE.wallet,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.profile,
      queryFn: fetchProfile,
      staleTime: STALE.profile,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.notifications,
      queryFn: fetchNotifications,
      staleTime: STALE.notifications,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.ads('home_carousel'),
      queryFn: () => fetchAds('home_carousel'),
      staleTime: STALE.ads,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.ads('services_carousel'),
      queryFn: () => fetchAds('services_carousel'),
      staleTime: STALE.ads,
    });
    return;
  }

  // Cold first load — normal path: sync, then fetch critical APIs.
  await withRetries(() => syncSessionToDatabase(), 3);

  await withRetries(
    () =>
      queryClient.fetchQuery({
        queryKey: queryKeys.wallet,
        queryFn: fetchWallet,
        staleTime: STALE.wallet,
      }),
    3,
  );

  // Profile next; secondary endpoints after UI is allowed to open.
  void queryClient
    .fetchQuery({
      queryKey: queryKeys.profile,
      queryFn: fetchProfile,
      staleTime: STALE.profile,
    })
    .catch(() => undefined);

  void queryClient.prefetchQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
    staleTime: STALE.notifications,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.ads('home_carousel'),
    queryFn: () => fetchAds('home_carousel'),
    staleTime: STALE.ads,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.ads('services_carousel'),
    queryFn: () => fetchAds('services_carousel'),
    staleTime: STALE.ads,
  });
}
