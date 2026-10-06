import { useAuth } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtpInput } from '@/components/auth/otp-input';
import { Button } from '@/components/ui/button';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useTwoFactorOptional } from '@/context/two-factor-context';

export function TwoFactorOverlay() {
  const twoFa = useTwoFactorOptional();
  // Challenge UI only — boot no longer waits on 2FA status.
  if (!twoFa?.blocking) return null;
  return <TwoFactorChallenge twoFa={twoFa} />;
}

function TwoFactorChallenge({
  twoFa,
}: {
  twoFa: NonNullable<ReturnType<typeof useTwoFactorOptional>>;
}) {
  const { signOut } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function onVerify(otp = code) {
    if (otp.length < 6 || busy) return;
    setBusy(true);
    setError(false);
    try {
      await twoFa.verify(otp);
      setCode('');
    } catch {
      setError(true);
      setCode('');
    } finally {
      setBusy(false);
    }
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
            <Text style={styles.title}>Authenticator code</Text>
            <Text style={styles.sub}>
              Enter the 6-digit code from Google Authenticator to continue.
            </Text>
          </Animated.View>

          <OtpInput
            value={code}
            onChange={(v) => {
              setError(false);
              setCode(v);
            }}
            error={error}
            onComplete={(otp) => void onVerify(otp)}
          />

          <Button
            title={busy ? 'Verifying…' : 'Verify & Continue'}
            onPress={() => void onVerify()}
            loading={busy}
            disabled={code.length < 6 || busy}
          />

          <Pressable onPress={() => void signOut()} hitSlop={10}>
            <Text style={styles.signOut}>Use a different account</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 90,
      elevation: 90,
      backgroundColor: colors.background,
    },
    panel: {
      flex: 1,
      paddingHorizontal: 24,
      gap: 22,
      backgroundColor: colors.background,
    },
    brand: { alignItems: 'center', gap: 10 },
    logoWell: {
      width: 56,
      height: 56,
      borderRadius: 999,
      overflow: 'hidden',
    },
    logo: { width: '100%', height: '100%' },
    brandName: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    copy: { alignItems: 'center', gap: 8, marginTop: 8 },
    title: { fontSize: 26, fontWeight: '800', color: colors.foreground },
    sub: {
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      color: colors.mutedForeground,
      paddingHorizontal: 12,
    },
    signOut: {
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
  });
}
