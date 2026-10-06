import { Redirect } from 'expo-router';

/** Legacy route — jump straight to onboarding (no timed splash). */
export default function SplashScreen() {
  return <Redirect href="/(auth)/onboarding" />;
}
