import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { SplashLoading } from '@/components/ui/splash-loading';
import { useAppTheme } from '@/context/theme-context';
import { useQueryHydrated } from '@/context/query-provider';
import { useTwoFactorOptional } from '@/context/two-factor-context';
import { bootstrapSignedInSession, hasWarmAppCache } from '@/lib/app-boot';

const BootReadyContext = createContext(false);

export function useBootReady() {
  return useContext(BootReadyContext);
}

/**
 * One continuous splash from app open until:
 * - query cache hydrated
 * - theme preference loaded
 * - Clerk loaded
 * - (if signed in) 2FA status known
 * - (if signed in) wallet/session bootstrap finished (or warm cache present)
 *
 * Avoids the dark blank gap before the dashboard appears.
 */
export function BootGate({ children }: { children: ReactNode }) {
  const hydrated = useQueryHydrated();
  const { ready: themeReady } = useAppTheme();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const queryClient = useQueryClient();
  const twoFa = useTwoFactorOptional();
  const [sessionReady, setSessionReady] = useState(false);
  const bootStarted = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      bootStarted.current = false;
      setSessionReady(true);
      return;
    }

    // Signed-in again after logout — require a fresh bootstrap.
    setSessionReady(hasWarmAppCache(queryClient));
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    if (!hydrated || !themeReady || !isLoaded) return;

    if (!isSignedIn) {
      setSessionReady(true);
      return;
    }

    // Wait for 2FA status; challenge UI is handled by TwoFactorOverlay.
    if (twoFa && !twoFa.ready) return;
    if (twoFa?.blocking) {
      setSessionReady(true);
      return;
    }

    if (bootStarted.current) return;
    bootStarted.current = true;

    const warm = hasWarmAppCache(queryClient);
    if (warm) {
      setSessionReady(true);
      void bootstrapSignedInSession({ queryClient, getToken, warm: true }).catch(
        (error) => {
          if (__DEV__) console.warn('[ORYNO boot] warm refresh failed', error);
        },
      );
      return;
    }

    void bootstrapSignedInSession({ queryClient, getToken, warm: false })
      .then(() => setSessionReady(true))
      .catch((error) => {
        if (__DEV__) console.warn('[ORYNO boot] cold bootstrap failed', error);
        // Still enter the app so the user isn't stuck on splash forever.
        setSessionReady(true);
      });
  }, [
    hydrated,
    themeReady,
    isLoaded,
    isSignedIn,
    twoFa,
    twoFa?.ready,
    twoFa?.blocking,
    queryClient,
    getToken,
  ]);

  const waitingTwoFa = Boolean(isSignedIn && twoFa && !twoFa.ready);
  const waitingSession = Boolean(isSignedIn && !sessionReady && !twoFa?.blocking);
  const booting =
    !hydrated || !themeReady || !isLoaded || waitingTwoFa || waitingSession;

  if (booting) {
    return <SplashLoading />;
  }

  return (
    <BootReadyContext.Provider value={true}>{children}</BootReadyContext.Provider>
  );
}
