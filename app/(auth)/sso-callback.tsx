import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useEffect, useRef } from 'react';

import { SplashLoading } from '@/components/ui/splash-loading';
import { syncSessionToDatabase } from '@/lib/auth-sync';

/**
 * Deep-link landing after Google / Apple OAuth (`oryno://sso-callback`).
 * Clerk's useSSO usually finishes in the opener; this catches cold-start returns.
 */
export default function SsoCallbackScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || synced.current) return;
    synced.current = true;
    void syncSessionToDatabase({ announceLogin: true }).catch(() => undefined);
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return <SplashLoading />;
  }

  if (isSignedIn) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
