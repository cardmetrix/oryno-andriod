import { useSignIn } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SocialAuth } from '@/components/auth/social-auth';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { syncSessionToDatabase } from '@/lib/auth-sync';

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const finish = async (sessionId: string | null | undefined) => {
    if (!sessionId || !setActive) return;
    await setActive({ session: sessionId });
    try {
      await syncSessionToDatabase({ announceLogin: true });
    } catch {
      // session is active even if sync fails once
    }
    router.replace('/(app)/(tabs)');
  };

  const onSubmit = async () => {
    if (!isLoaded || !signIn) return;
    if (!email || !password) {
      alert.warning('Missing fields', 'Enter email and password to continue.');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await finish(result.createdSessionId);
        return;
      }
      if (result.status === 'needs_second_factor') {
        const emailFactor = result.supportedSecondFactors?.find((f) => f.strategy === 'email_code');
        if (emailFactor && 'emailAddressId' in emailFactor) {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId as string,
          });
        }
        router.push({
          pathname: '/(auth)/otp',
          params: { mode: 'login', email: email.trim() },
        });
        return;
      }
      alert.warning('Sign in incomplete', `Status: ${result.status}`);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'errors' in e
          ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Sign in failed')
          : 'Sign in failed';
      alert.error('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.logoWell}>
          <Image
            source={require('@/assets/images/oryno-icon.png')}
            style={styles.logo}
            contentFit="cover"
          />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Sign in to access your borderless wallet
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Email or Phone Number"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@email.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          placeholder="••••••••"
        />
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>
        </Link>
        <Button title="Sign In" onPress={onSubmit} loading={loading} />
        <SocialAuth mode="signIn" />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Don&apos;t have an account?{' '}
        </Text>
        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text style={styles.link}>Create Account</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: 28, paddingBottom: 28, gap: 8 },
  logoWell: {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  logo: { width: '100%', height: '100%', borderRadius: 999,},
  title: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, textAlign: 'center' },
  form: { gap: 14 },
  forgot: { alignSelf: 'flex-end', color: Brand.orange, fontWeight: '600', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28, alignItems: 'center' },
  footerText: { fontSize: 14 },
  link: { color: Brand.orange, fontWeight: '700', fontSize: 14 },
});
