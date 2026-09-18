import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';

type SettleResult = {
  ok?: boolean;
  scanned?: number;
  completed?: number;
  reversed?: number;
  failed?: number;
};

const POLL_MS = 60_000;

/**
 * Checks pending/processing transactions and settles them from provider state.
 * Mirrors website `useSettlePendingTransactions`.
 */
export function useSettlePendingTransactions(enabled = true) {
  const invalidateWallet = useInvalidateWallet();
  const inFlightRef = useRef(false);

  const settle = useCallback(async () => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const json = await api.post<SettleResult>(endpoints.transactions.settle, {});
      if ((json.completed ?? 0) + (json.reversed ?? 0) + (json.failed ?? 0) > 0) {
        invalidateWallet();
      }
      return json;
    } catch (error) {
      if (__DEV__) console.warn('[settle-pending]', error);
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [invalidateWallet]);

  useEffect(() => {
    if (!enabled) return;
    void settle();
    const id = setInterval(() => {
      void settle();
    }, POLL_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void settle();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [enabled, settle]);

  return { settle };
}
