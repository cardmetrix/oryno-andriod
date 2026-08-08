import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';
import type { WalletPayload } from '@/lib/types';

export async function fetchWallet() {
  return api.get<WalletPayload>(endpoints.wallet.root);
}

export function useWallet() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const staleToastShown = useRef(false);

  const query = useQuery({
    queryKey: queryKeys.wallet,
    queryFn: fetchWallet,
    enabled: isLoaded && Boolean(isSignedIn),
    staleTime: STALE.wallet,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      queryClient.removeQueries({ queryKey: queryKeys.wallet });
      staleToastShown.current = false;
    }
  }, [isLoaded, isSignedIn, queryClient]);

  useEffect(() => {
    if (query.isError && query.data && !staleToastShown.current) {
      staleToastShown.current = true;
      toast.message('Showing last balance — reconnecting…');
    }
    if (query.isSuccess) {
      staleToastShown.current = false;
    }
  }, [query.isError, query.isSuccess, query.data]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
  }, [queryClient]);

  const loading = query.isLoading && !query.data;
  const softLoading = query.isFetching && Boolean(query.data);
  const error =
    query.error instanceof Error
      ? query.error.message
      : query.isError
        ? 'Failed to load wallet'
        : null;

  return {
    data: query.data ?? null,
    loading,
    softLoading,
    isFetching: query.isFetching,
    error: query.data ? null : error,
    staleError: query.data && error ? error : null,
    refresh,
  };
}
