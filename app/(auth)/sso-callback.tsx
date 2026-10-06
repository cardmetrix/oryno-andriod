import { useAuth, useSignUp } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { syncSessionToDatabase } from '@/lib/auth-sync';

/**
 * Deep-link landing after Google / Apple OAuth (`oryno://sso-callback`).
 * Mirrors website `/sso-callback` → `/continue` when signup still needs fields,
 * otherwise → dashboard after sync.
 */
export default function SsoCallbackScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const synced = useRef(false);

  const needsContinue =
    signUpLoaded &&
    Boolean(signUp?.id) &&
    (signUp?.status === 'missing_requirements' ||
      (signUp?.missingFields?.length ?? 0) > 0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || synced.current || needsContinue) return;
    synced.current = true;
    void syncSessionToDatabase({ announceLogin: true }).catch(() => undefined);
  }, [isLoaded, isSignedIn, needsContinue]);

  if (!isLoaded || !signUpLoaded) {
    return <View style={{ flex: 1 }} />;
  }

  if (needsContinue) {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/sso-continue',
          params: { mode: 'signUp' },
        }}
      />
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  // OAuth may land here before session activation with an open sign-up.
  if (signUp?.id) {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/sso-continue',
          params: { mode: 'signUp' },
        }}
      />
    );
  }

  return <Redirect href="/(auth)/login" />;
}
