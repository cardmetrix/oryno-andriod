import { Stack } from 'expo-router';

import { fadeScreenOptions, stackScreenOptions } from '@/constants/transitions';
import { useAppTheme } from '@/context/theme-context';

export default function AuthLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="onboarding" options={{ ...fadeScreenOptions, gestureEnabled: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="otp" options={{ animation: 'fade_from_bottom', animationDuration: 340 }} />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="sso-callback" options={{ animation: 'none' }} />
      <Stack.Screen name="sso-continue" />
      <Stack.Screen name="splash" options={{ animation: 'fade' }} />
    </Stack>
  );
}
