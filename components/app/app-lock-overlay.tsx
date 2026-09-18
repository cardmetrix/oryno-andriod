import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppLock } from '@/context/app-lock-context';
import { useAppTheme } from '@/context/theme-context';
import { useTwoFactorOptional } from '@/context/two-factor-context';
import { biometricErrorMessage } from '@/lib/biometric';

export function AppLockOverlay() {
  const { locked, unlock, meta } = useAppLock();
  const twoFa = useTwoFactorOptional();
  const { signOut } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locked) {
      setError(null);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    void unlock().then((ok) => {
      if (cancelled) return;
      setBusy(false);
      if (!ok) setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [locked, unlock]);

  if (!locked || twoFa?.blocking) return null;

  async function onUnlock() {
    setBusy(true);
    setError(null);
    const ok = await unlock();
    setBusy(false);
    if (!ok) setError(biometricErrorMessage('authentication_failed', meta));
  }

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View entering={FadeIn.duration(280)} style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.panel,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 },
          ]}>
          <Animated.View entering={FadeInUp.delay(80).duration(360)} style={styles.brand}>
            <View style={styles.logoWell}>
              <Image
                source={require('@/assets/images/oryno-icon.png')}
                style={styles.logo}
                contentFit="cover"
              />
            </View>
            <Text style={styles.brandName}>ORYNO</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(140).duration(380)} style={styles.copy}>
            <View style={styles.iconBubble}>
              <Ionicons name="finger-print" size={28} color={Brand.orange} />
            </View>
            <Text style={styles.title}>App locked</Text>
            <Text style={styles.sub}>Use your fingerprint to unlock</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(380)} style={styles.actions}>
            <Button
              title={busy ? 'Waiting…' : 'Use your fingerprint'}
              onPress={() => void onUnlock()}
              loading={busy}
              disabled={busy}
            />
            <Pressable
              onPress={() => void signOut()}
              style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 80,
      elevation: 80,
    },
    panel: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoWell: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
    },
    logo: { width: '100%', height: '100%' },
    brandName: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 1.4,
      color: Brand.orange,
    },
    copy: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    iconBubble: {
      width: 72,
      height: 72,
      borderRadius: 28,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.foreground,
    },
    sub: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    error: {
      marginTop: 8,
      color: Brand.error,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    actions: { gap: 14 },
    signOut: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    signOutText: {
      color: colors.mutedForeground,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
