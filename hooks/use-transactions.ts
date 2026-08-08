import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { groupTransactionsByDate, type TransactionGroup } from '@/lib/transactions';
import type { AppTransaction } from '@/lib/types';

export type TransactionsResponse = {
  items?: AppTransaction[];
  groups?: TransactionGroup[];
};

export async function fetchTransactions() {
  return api.get<TransactionsResponse>(endpoints.transactions.list);
}

export function useTransactions() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.transactions,
    queryFn: fetchTransactions,
    enabled: isLoaded && Boolean(isSignedIn),
    staleTime: STALE.transactions,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      queryClient.removeQueries({ queryKey: queryKeys.transactions });
    }
  }, [isLoaded, isSignedIn, queryClient]);

  const items = query.data?.items ?? [];
  const groups = useMemo(() => {
    if (!query.data) return [];
    return query.data.groups?.length
      ? query.data.groups
      : groupTransactionsByDate(query.data.items ?? []);
  }, [query.data]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
  }, [queryClient]);

  return {
    items,
    groups,
    loading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    error: query.isError && !query.data,
    refresh,
  };
}
