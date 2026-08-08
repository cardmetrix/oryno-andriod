import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';

/** Call after wallet-affecting purchases / fund / withdraw. */
export function invalidateWalletRelated(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
  void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
}
