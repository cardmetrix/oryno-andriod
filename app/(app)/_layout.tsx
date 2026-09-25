import { useAuth } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

import {
  formSheetScreenOptions,
  modalScreenOptions,
  stackScreenOptions,
} from '@/constants/transitions';
import { useAppTheme } from '@/context/theme-context';

/**
 * Signed-in shell. Session/wallet bootstrap is owned by BootGate so the splash
 * stays up until the dashboard is ready (no dark blank gap).
 */
export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { colors } = useAppTheme();

  if (!isLoaded) return null;

  if (!isSignedIn) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: 200, gestureEnabled: false }} />
      <Stack.Screen name="fund" options={modalScreenOptions} />
      <Stack.Screen name="convert" options={modalScreenOptions} />
      <Stack.Screen name="withdraw" options={modalScreenOptions} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="wallet/add-bank" options={formSheetScreenOptions} />
      <Stack.Screen name="support" />
      <Stack.Screen name="referrals" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/security" />
      <Stack.Screen name="invoices/index" />
      <Stack.Screen name="invoices/new" />
      <Stack.Screen name="invoices/[id]" />
      <Stack.Screen name="payment-links/index" />
      <Stack.Screen name="payment-links/new" />
      <Stack.Screen name="history/[id]" />
      <Stack.Screen name="history/analytics" />
      <Stack.Screen name="services/index" />
      <Stack.Screen name="services/airtime" />
      <Stack.Screen name="services/data" />
      <Stack.Screen name="services/bills" />
      <Stack.Screen name="services/electricity" />
      <Stack.Screen name="services/tv" />
      <Stack.Screen name="services/betting" />
      <Stack.Screen name="services/social" />
      <Stack.Screen name="services/gift-cards" />
      <Stack.Screen name="services/gift-cards-live" />
      <Stack.Screen name="services/virtual-numbers" />
      <Stack.Screen name="services/emails" />
      <Stack.Screen name="services/international-gifting" />
      <Stack.Screen name="admin" options={{ headerShown: false, animation: 'fade', animationDuration: 220 }} />
    </Stack>
  );
}
