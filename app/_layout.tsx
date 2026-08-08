import { ClerkProvider } from '@clerk/clerk-expo';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import 'react-native-reanimated';

import { PushNotificationShell } from '@/components/notifications/push-notification-shell';
import { ThemeSync } from '@/components/theme-sync';
import { AlertSheetHost } from '@/components/ui/alert-sheet';
import { Toaster } from '@/components/ui/toaster';
import { Brand } from '@/constants/theme';
import { fadeScreenOptions } from '@/constants/transitions';
import { ApiAuthBridge } from '@/context/api-provider';
import { PushNotificationProvider } from '@/context/push-notification-context';
import { AppQueryProvider } from '@/context/query-provider';
import { AppThemeProvider, useAppTheme } from '@/context/theme-context';
import { tokenCache } from '@/lib/clerk-token-cache';
import { CLERK_PUBLISHABLE_KEY } from '@/lib/config';
import { configurePushNotificationHandler } from '@/lib/push-notifications';

configurePushNotificationHandler();

export const unstable_settings = {
  anchor: '(auth)',
};

function NavigationRoot() {
  const { isDark, colors } = useAppTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.tint,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: Brand.orange,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={fadeScreenOptions}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack>
      <ThemeSync />
      <PushNotificationShell />
      <Toaster />
      <AlertSheetHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ textAlign: 'center', color: '#1C1C1E' }}>
          Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <AppQueryProvider>
        <AppThemeProvider>
          <ApiAuthBridge>
            <PushNotificationProvider>
              <NavigationRoot />
            </PushNotificationProvider>
          </ApiAuthBridge>
        </AppThemeProvider>
      </AppQueryProvider>
    </ClerkProvider>
  );
}
