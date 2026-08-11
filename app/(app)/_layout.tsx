import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';

import { SplashLoading } from '@/components/ui/splash-loading';
import {
  formSheetScreenOptions,
  stackScreenOptions,
} from '@/constants/transitions';
import { useAppTheme } from '@/context/theme-context';
import { bootstrapSignedInSession, hasWarmAppCache } from '@/lib/app-boot';

export default function AppLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const bootStarted = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      bootStarted.current = false;
      return;
    }
    if (!isLoaded || bootStarted.current) return;

    bootStarted.current = true;
    const warm = hasWarmAppCache(queryClient);
    void bootstrapSignedInSession({ queryClient, getToken, warm }).catch((error) => {
      if (__DEV__) {
        console.warn('[ORYNO app] boot failed', error);
      }
    });
  }, [isLoaded, isSignedIn, getToken, queryClient]);

  if (!isLoaded) {
    return <SplashLoading />;
  }

  if (!isSignedIn) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen
        name="fund"
        options={{
          ...formSheetScreenOptions,
          sheetAllowedDetents: [0.72, 0.94],
          sheetInitialDetentIndex: 0,
        }}
      />
      <Stack.Screen
        name="withdraw"
        options={{
          ...formSheetScreenOptions,
          sheetAllowedDetents: [0.72, 0.94],
          sheetInitialDetentIndex: 0,
        }}
      />
      <Stack.Screen name="notifications" options={formSheetScreenOptions} />
      <Stack.Screen name="wallet/add-bank" options={formSheetScreenOptions} />
      <Stack.Screen name="support" />
      <Stack.Screen name="referrals" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/security" />
      <Stack.Screen name="settings/levels" />
      <Stack.Screen name="settings/kyc" />
      <Stack.Screen name="history/[id]" />
      <Stack.Screen name="history/analytics" />
      <Stack.Screen name="services/airtime" />
      <Stack.Screen name="services/data" />
      <Stack.Screen name="services/bills" />
      <Stack.Screen name="services/social" />
      <Stack.Screen name="services/gift-cards" />
      <Stack.Screen name="services/gift-cards-live" />
      <Stack.Screen name="services/virtual-numbers" />
      <Stack.Screen name="services/emails" />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}
