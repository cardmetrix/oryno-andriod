import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

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
  const [ready, setReady] = useState(false);
  const bootStarted = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      bootStarted.current = false;
      setReady(true);
      return;
    }

    if (bootStarted.current) {
      setReady(true);
      return;
    }

    bootStarted.current = true;
    let cancelled = false;
    const warm = hasWarmAppCache(queryClient);

    (async () => {
      try {
        if (warm) {
          // Fast path: show cached home immediately, refresh in background.
          if (!cancelled) setReady(true);
          await bootstrapSignedInSession({ queryClient, getToken, warm: true });
          return;
        }

        // First load: keep splash until sync + wallet succeed.
        await bootstrapSignedInSession({ queryClient, getToken, warm: false });
        if (!cancelled) setReady(true);
      } catch (error) {
        if (__DEV__) {
          console.warn('[ORYNO app] cold boot failed — entering app anyway', error);
        }
        // Still enter so user isn't stuck on splash forever.
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, queryClient]);

  if (!isLoaded || !ready) {
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
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/security" />
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
