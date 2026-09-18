import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';

/**
 * Launch routing (Clerk is already loaded by AppQueryProvider boot gate):
 * - Not logged in → onboarding
 * - Logged in → app shell
 */
export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Boot splash already waited for Clerk — avoid a second SplashLoading remount.
  if (!isLoaded) return null;

  if (isSignedIn) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
