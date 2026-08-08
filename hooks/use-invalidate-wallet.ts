import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { invalidateWalletRelated } from '@/lib/query-invalidation';

export function useInvalidateWallet() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    invalidateWalletRelated(queryClient);
  }, [queryClient]);
}
