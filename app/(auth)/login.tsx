import { useAuth, useClerk, useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SocialAuth } from '@/components/auth/social-auth';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { syncSessionToDatabase, continueAfterSignedIn } from '@/lib/auth-sync';
import {
  authenticateBiometric,
  biometricErrorMessage,
  getBiometricMeta,
  type BiometricMeta,
} from '@/lib/biometric';
import {
  clearBiometricLogin,
  readBiometricLogin,
  saveBiometricLogin,
  type StoredBiometricLogin,
} from '@/lib/biometric-login';
import {
  clerkErrorMessage,
  existingSessionIdFromClerkError,
  isSessionAlreadyExistsError,
  needsContinueFlow,
  pickLoginSecondFactor,
} from '@/lib/clerk-errors';

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn, sessionId } = useAuth();
  const clerk = useClerk();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [meta, setMeta] = useState<BiometricMeta | null>(null);
  const [savedLogin, setSavedLogin] = useState<StoredBiometricLogin | null>(null);
  const autoPrompted = useRef(false);

  const finish = useCallback(
    async (nextSessionId: string | null | undefined) => {
      if (!nextSessionId || !setActive) return;
      await setActive({ session: nextSessionId });
      try {
        const sync = await syncSessionToDatabase({ announceLogin: true });
        await continueAfterSignedIn(sync);
      } catch {
        await continueAfterSignedIn(null);
      }
    },
    [setActive],
  );

  const resumeExistingSession = useCallback(
    async (err?: unknown) => {
      const fromError = err ? existingSessionIdFromClerkError(err) : null;
      const lastActive =
        typeof clerk.client?.lastActiveSessionId === 'string'
          ? clerk.client.lastActiveSessionId
          : null;
      const existing = fromError || sessionId || lastActive;
      if (existing) {
        await finish(existing);
        return;
      }
      // Session is already active in Clerk but we lack an id — enter the app.
      await continueAfterSignedIn(null);
    },
    [clerk.client?.lastActiveSessionId, finish, sessionId],
  );

  const signInWithPassword = useCallback(
    async (identifier: string, secret: string, remember: boolean) => {
      if (!isLoaded || !signIn) return;

      // Already signed in — don't call create (Clerk throws session_exists).
      if (isSignedIn) {
        await resumeExistingSession();
        return;
      }

      try {
        const result = await signIn.create({
          identifier: identifier.trim(),
          password: secret,
        });
        if (result.status === 'complete') {
          if (remember && meta?.available) {
            await saveBiometricLogin(identifier.trim(), secret);
          }
          await finish(result.createdSessionId);
          return;
        }
        if (result.status === 'needs_second_factor') {
          if (remember && meta?.available) {
            await saveBiometricLogin(identifier.trim(), secret);
          }
          const next = pickLoginSecondFactor(result.supportedSecondFactors);
          if (next === 'email_code') {
            const emailFactor = result.supportedSecondFactors?.find(
              (f) => f.strategy === 'email_code',
            );
            if (emailFactor && 'emailAddressId' in emailFactor) {
              await signIn.prepareSecondFactor({
                strategy: 'email_code',
                emailAddressId: emailFactor.emailAddressId as string,
              });
            }
          }
          router.push({
            pathname: '/(auth)/otp',
            params: {
              mode: next === 'totp' ? 'totp' : 'login',
              email: identifier.trim(),
            },
          });
          return;
        }
        // Mirror website: incomplete sign-in → /continue (sso-continue)
        router.replace({
          pathname: '/(auth)/sso-continue',
          params: { mode: 'signIn' },
        });
      } catch (e: unknown) {
        if (isSessionAlreadyExistsError(e)) {
          if (remember && meta?.available) {
            await saveBiometricLogin(identifier.trim(), secret);
          }
          await resumeExistingSession(e);
          return;
        }
        if (needsContinueFlow(e)) {
          router.replace({
            pathname: '/(auth)/sso-continue',
            params: { mode: 'signIn' },
          });
          return;
        }
        throw e;
      }
    },
    [finish, isLoaded, isSignedIn, meta?.available, resumeExistingSession, signIn],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [nextMeta, stored] = await Promise.all([getBiometricMeta(), readBiometricLogin()]);
      if (cancelled) return;
      setMeta(nextMeta);
      setSavedLogin(stored);
      if (stored?.identifier && !email) setEmail(stored.identifier);
    })();
    return () => {
      cancelled = true;
    };
    // Prefill once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBiometricLogin = useCallback(async () => {
    if (!meta?.available) {
      alert.warning(
        meta?.title || 'Biometric sign-in',
        meta?.hasHardware
          ? `Set up ${meta.title} in your device settings first.`
          : 'Biometrics are not available on this device.',
      );
      return;
    }
    if (!savedLogin) {
      alert.info(
        `Sign in with ${meta.title}`,
        'Sign in with email and password once. Next time you can use biometrics on this device.',
      );
      return;
    }

    setBioLoading(true);
    try {
      const result = await authenticateBiometric(`Sign in to ORYNO with ${meta.title}`);
      if (!result.success) {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
          alert.error(meta.title, biometricErrorMessage(result.error, meta));
        }
        return;
      }
      await signInWithPassword(savedLogin.identifier, savedLogin.password, true);
    } catch (e: unknown) {
      if (isSessionAlreadyExistsError(e)) {
        await resumeExistingSession(e);
        return;
      }
      const msg = clerkErrorMessage(e, 'Sign in failed');
      await clearBiometricLogin();
      setSavedLogin(null);
      alert.error(
        'Sign in failed',
        `${msg} Sign in with your password to set up ${meta.title} again.`,
      );
    } finally {
      setBioLoading(false);
    }
  }, [meta, resumeExistingSession, savedLogin, signInWithPassword]);

  useEffect(() => {
    if (autoPrompted.current || !meta?.available || !savedLogin || !isLoaded) return;
    autoPrompted.current = true;
    const t = setTimeout(() => {
      void onBiometricLogin();
    }, 400);
    return () => clearTimeout(t);
  }, [isLoaded, meta?.available, onBiometricLogin, savedLogin]);

  const onSubmit = async () => {
    if (!isLoaded || !signIn) return;
    if (!email || !password) {
      alert.warning('Missing fields', 'Enter email and password to continue.');
      return;
    }
    setLoading(true);
    try {
      await signInWithPassword(email, password, true);
    } catch (e: unknown) {
      if (isSessionAlreadyExistsError(e)) {
        await resumeExistingSession(e);
        return;
      }
      alert.error('Sign in failed', clerkErrorMessage(e, 'Sign in failed'));
    } finally {
      setLoading(false);
    }
  };

  const bioTitle = meta?.title || 'Biometric sign-in';
  const showBio = Boolean(meta && (meta.available || meta.hasHardware));

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
        <Button title="Sign In" onPress={onSubmit} loading={loading} disabled={bioLoading} />

        {showBio ? (
          <Pressable
            onPress={() => void onBiometricLogin()}
            disabled={loading || bioLoading}
            style={({ pressed }) => [
              styles.bioBtn,
              pressed && styles.bioPressed,
              (loading || bioLoading) && styles.bioDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Sign in with ${bioTitle}`}>
            {bioLoading ? (
              <ActivityIndicator color={Brand.orange} />
            ) : (
              <Ionicons name="finger-print" size={32} color={Brand.orange} />
            )}
          </Pressable>
        ) : null}

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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: { alignItems: 'center', paddingTop: 28, paddingBottom: 28, gap: 8 },
    logoWell: {
      width: 56,
      height: 56,
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 8,
    },
    logo: { width: '100%', height: '100%', borderRadius: 999 },
    title: { fontSize: 28, fontWeight: '800' },
    sub: { fontSize: 14, textAlign: 'center' },
    form: { gap: 14 },
    forgot: { alignSelf: 'flex-end', color: Brand.orange, fontWeight: '600', fontSize: 13 },
    bioBtn: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bioPressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
    bioDisabled: { opacity: 0.55 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28, alignItems: 'center' },
    footerText: { fontSize: 14 },
    link: { color: Brand.orange, fontWeight: '700', fontSize: 14 },
  });
}
