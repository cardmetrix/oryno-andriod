import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useLayoutEffect } from 'react';

import { SplashLoading } from '@/components/ui/splash-loading';
import { usePrefetchAppData } from '@/hooks/use-prefetch-app-data';
import { setApiAuthReady, setApiTokenGetter } from '@/lib/api';

function peekTokenClaims(token: string | null | undefined) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = json + '='.repeat((4 - (json.length % 4)) % 4);
    // atob is available in Hermes / RN
    const payload = JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
    return {
      sub: payload.sub,
      azp: payload.azp,
      iss: payload.iss,
      sid: payload.sid,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function PrefetchWhenReady({ children }: { children: React.ReactNode }) {
  usePrefetchAppData();
  return <>{children}</>;
}

/** Wires Clerk session JWTs into the shared API client before children mount. */
export function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded, userId } = useAuth();

  // Register before paint so early API calls can resolve a token.
  // Use Clerk's cached JWT — skipCache only on login sync (app layout).
  useLayoutEffect(() => {
    setApiTokenGetter(async () => {
      try {
        const token = await getToken();
        if (__DEV__) {
          console.log('[ORYNO API] getToken claims', peekTokenClaims(token));
        }
        return token;
      } catch (error) {
        if (__DEV__) {
          console.warn('[ORYNO API] getToken failed', error);
        }
        return null;
      }
    });
  }, [getToken]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[ORYNO API] auth bridge', {
        isLoaded: Boolean(isLoaded),
        isSignedIn: Boolean(isSignedIn),
        userId: userId ?? null,
      });
    }
    if (!isLoaded) {
      setApiAuthReady(false);
      return;
    }
    setApiAuthReady(true);
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded) {
    return <SplashLoading />;
  }

  return <PrefetchWhenReady>{children}</PrefetchWhenReady>;
}
