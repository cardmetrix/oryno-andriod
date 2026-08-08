import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';

import { SplashLoading } from '@/components/ui/splash-loading';

/**
 * Launch routing:
 * - Boot → splash loading
 * - Not logged in → onboarding
 * - Logged in → app shell (splash while session syncs)
 */
export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <SplashLoading />;
  }

  if (isSignedIn) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
