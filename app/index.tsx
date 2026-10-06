import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';

/**
 * Launch routing:
 * - Not logged in → onboarding
 * - Logged in → app shell
 */
export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
