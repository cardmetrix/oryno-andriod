import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

import { useQueryHydrated } from '@/context/query-provider';
import { bootstrapSignedInSession, hasWarmAppCache } from '@/lib/app-boot';

const BootReadyContext = createContext(true);

export function useBootReady() {
  return useContext(BootReadyContext);
}

/**
 * Starts signed-in session bootstrap in the background.
 * Never blocks the UI with a splash — dashboard uses its own skeletons.
 */
export function BootGate({ children }: { children: ReactNode }) {
  const hydrated = useQueryHydrated();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const queryClient = useQueryClient();
  const bootStarted = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      bootStarted.current = false;
      return;
    }
    if (!hydrated || !isLoaded || bootStarted.current) return;
    bootStarted.current = true;

    const warm = hasWarmAppCache(queryClient);
    void bootstrapSignedInSession({ queryClient, getToken, warm }).catch((error) => {
      if (__DEV__) console.warn('[ORYNO boot] bootstrap failed', error);
    });
  }, [hydrated, isLoaded, isSignedIn, queryClient, getToken]);

  return (
    <BootReadyContext.Provider value={true}>{children}</BootReadyContext.Provider>
  );
}
