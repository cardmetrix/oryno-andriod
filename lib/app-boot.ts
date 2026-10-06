import type { QueryClient } from '@tanstack/react-query';

import { fetchAds } from '@/hooks/use-ads';
import { fetchNotifications } from '@/hooks/use-notifications-query';
import { fetchProfile } from '@/hooks/use-profile';
import { fetchWallet } from '@/hooks/use-wallet';
import { ApiError, api, waitForApiAuth } from '@/lib/api';
import { syncSessionToDatabase } from '@/lib/auth-sync';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function hasWarmAppCache(queryClient: QueryClient) {
  return Boolean(queryClient.getQueryData(queryKeys.wallet));
}

type GetToken = (opts?: { skipCache?: boolean }) => Promise<string | null | undefined>;

async function fetchDepositAccount() {
  try {
    return await api.get(endpoints.wallet.depositAccount);
  } catch (e) {
    if (e instanceof ApiError && e.body && typeof e.body === 'object') {
      return e.body;
    }
    throw e;
  }
}

/**
 * Warm up auth + critical queries in the background.
 * Never blocks first paint — screens show skeletons until data arrives.
 */
export async function bootstrapSignedInSession(options: {
  queryClient: QueryClient;
  getToken: GetToken;
  warm: boolean;
}) {
  const { queryClient, getToken, warm } = options;

  await waitForApiAuth(4_000);

  let token = await getToken(warm ? undefined : { skipCache: true });
  if (!token) {
    token = await getToken({ skipCache: true });
  }
  if (!token) {
    throw new Error('Missing Clerk session token');
  }

  // Session sync is best-effort and never blocks wallet/home.
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
  // Warm fund options so Fund opens without a skeleton wait.
  void queryClient.prefetchQuery({
    queryKey: queryKeys.depositAccount,
    queryFn: fetchDepositAccount,
    staleTime: STALE.wallet,
  });
}
