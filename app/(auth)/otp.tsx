import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { OtpInput } from '@/components/auth/otp-input';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { syncSessionToDatabase } from '@/lib/auth-sync';

type OtpMode = 'register' | 'login';

export default function OtpScreen() {
  const params = useLocalSearchParams<{ mode?: string; email?: string }>();
  const mode: OtpMode = params.mode === 'login' ? 'login' : 'register';
  const email = typeof params.email === 'string' ? params.email : '';
  const { colors } = useAppTheme();

  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [seconds, setSeconds] = useState(54);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const finish = async (sessionId: string | null | undefined, announceLogin: boolean) => {
    const setActive = mode === 'login' ? setSignInActive : setSignUpActive;
    if (!sessionId || !setActive) return;
    await setActive({ session: sessionId });
    try {
      await syncSessionToDatabase(announceLogin ? { announceLogin: true } : undefined);
    } catch {
      // session is active even if sync fails once
    }
    router.replace('/(app)/(tabs)');
  };

  const onVerify = useCallback(
    async (otp = code) => {
      if (otp.length < 6) return;
      setLoading(true);
      setError(false);
      try {
        if (mode === 'register') {
          if (!signUpLoaded || !signUp) return;
          const result = await signUp.attemptEmailAddressVerification({ code: otp.trim() });
          if (result.status === 'complete') {
            await finish(result.createdSessionId, false);
          } else {
            alert.warning('Verification incomplete', `Status: ${result.status}`);
          }
          return;
        }

        if (!signInLoaded || !signIn) return;
        const result = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: otp.trim(),
        });
        if (result.status === 'complete') {
          await finish(result.createdSessionId, true);
        } else {
          alert.warning('Verification incomplete', `Status: ${result.status}`);
        }
      } catch (e: unknown) {
        setError(true);
        setCode('');
        const msg =
          typeof e === 'object' && e && 'errors' in e
            ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Invalid code')
            : 'Invalid code';
        alert.error('Verification failed', msg);
      } finally {
        setLoading(false);
      }
    },
    [code, mode, signIn, signInLoaded, signUp, signUpLoaded],
  );

  const resend = async () => {
    try {
      if (mode === 'register') {
        if (!signUpLoaded || !signUp) return;
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else {
        if (!signInLoaded || !signIn) return;
        const emailFactor = signIn.supportedSecondFactors?.find((f) => f.strategy === 'email_code');
        if (emailFactor && 'emailAddressId' in emailFactor) {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId as string,
          });
        }
      }
      setSeconds(54);
      setCode('');
      setError(false);
      alert.success('Code sent', 'A new verification code is on its way.');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'errors' in e
          ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Could not resend')
          : 'Could not resend the code';
      alert.error('Resend failed', msg);
    }
  };

  const backHref = mode === 'login' ? '/(auth)/login' : '/(auth)/register';

  return (
    <Screen scroll>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.top}>
        <Pressable onPress={() => router.replace(backHref)} hitSlop={12}>
          <Text style={[styles.back, { color: colors.mutedForeground }]}>← Back</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80).duration(480)} style={styles.header}>
        <View style={styles.logoGlow}>
          <Image
            source={require('@/assets/images/oryno-icon.png')}
            style={styles.logo}
            contentFit="cover"
          />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Verify it&apos;s you</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          We&apos;ve sent a 6-digit code to{'\n'}
          <Text style={[styles.email, { color: colors.foreground }]}>
            {email || 'your email'}
          </Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(160).duration(480)} style={styles.form}>
        <OtpInput
          value={code}
          onChange={(v) => {
            setError(false);
            setCode(v);
          }}
          error={error}
          onComplete={(otp) => void onVerify(otp)}
        />

        <Text style={[styles.resendLine, { color: colors.mutedForeground }]}>
          Didn&apos;t get a code?{' '}
          {seconds > 0 ? (
            <Text style={[styles.resendWait, { color: colors.foreground }]}>
              Resend in {seconds}s
            </Text>
          ) : (
            <Text style={styles.resendLink} onPress={() => void resend()}>
              Resend
            </Text>
          )}
        </Text>

        <Button
          title={loading ? 'Verifying…' : mode === 'login' ? 'Verify & Sign In' : 'Verify & Continue'}
          onPress={() => void onVerify()}
          loading={loading}
          disabled={code.length < 6 || loading}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: 8, marginBottom: 12 },
  back: { fontWeight: '700', fontSize: 14 },
  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 28, gap: 10 },
  logoGlow: {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  logo: { width: '100%', height: '100%', borderRadius: 999,},
  title: { fontSize: 28, fontWeight: '800' },
  sub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  email: { fontWeight: '700' },
  form: { gap: 22, marginTop: 8 },
  resendLine: { textAlign: 'center', fontSize: 14 },
  resendWait: { fontWeight: '700' },
  resendLink: { color: Brand.orange, fontWeight: '700' },
});
