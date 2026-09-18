import { useAuth, useClerk, useSSO } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GoogleIcon } from '@/components/auth/google-icon';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { syncSessionToDatabase, continueAfterSignedIn } from '@/lib/auth-sync';
import {
  clerkErrorMessage,
  existingSessionIdFromClerkError,
  isSessionAlreadyExistsError,
  needsContinueFlow,
} from '@/lib/clerk-errors';
import { getOAuthRedirectUrl } from '@/lib/oauth';
import { toast } from '@/lib/toast';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  mode?: 'signIn' | 'signUp';
};

type OAuthStrategy = 'oauth_google' | 'oauth_apple';

export function SocialAuth({ mode = 'signIn' }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { startSSOFlow } = useSSO();
  const { isSignedIn, sessionId } = useAuth();
  const clerk = useClerk();
  const [pending, setPending] = useState<OAuthStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const finishSession = useCallback(
    async (nextSessionId: string, setActive: (params: { session: string }) => Promise<void>) => {
      await setActive({ session: nextSessionId });
      try {
        const { readStoredReferralCode } = await import('@/lib/referrals');
        const referralCode =
          mode === 'signUp' ? await readStoredReferralCode() : null;
        const sync = await syncSessionToDatabase({
          announceLogin: mode === 'signIn',
          referralCode: referralCode || undefined,
        });
        toast.success(mode === 'signUp' ? 'Welcome to ORYNO' : 'Signed in');
        await continueAfterSignedIn(sync);
      } catch {
        toast.success(mode === 'signUp' ? 'Welcome to ORYNO' : 'Signed in');
        await continueAfterSignedIn(null);
      }
    },
    [mode],
  );

  const resumeExistingSession = useCallback(
    async (err?: unknown) => {
      const fromError = err ? existingSessionIdFromClerkError(err) : null;
      const lastActive =
        typeof clerk.client?.lastActiveSessionId === 'string'
          ? clerk.client.lastActiveSessionId
          : null;
      const existing = fromError || sessionId || lastActive;
      if (existing && clerk.setActive) {
        await finishSession(existing, clerk.setActive);
        return;
      }
      toast.success(mode === 'signUp' ? 'Welcome to ORYNO' : 'Signed in');
      await continueAfterSignedIn(null);
    },
    [clerk.client?.lastActiveSessionId, clerk.setActive, finishSession, mode, sessionId],
  );

  const startOAuth = useCallback(
    async (strategy: OAuthStrategy) => {
      setError(null);
      setPending(strategy);

      const provider = strategy === 'oauth_google' ? 'Google' : 'Apple';
      const fallback =
        mode === 'signUp'
          ? `${provider} sign-up failed. Try email instead.`
          : `${provider} sign-in failed. Try email instead.`;

      try {
        if (isSignedIn) {
          await resumeExistingSession();
          return;
        }

        const redirectUrl = getOAuthRedirectUrl();
        console.log('[ORYNO OAuth] starting', { strategy, redirectUrl });

        const { createdSessionId, setActive, signIn, signUp, authSessionResult } =
          await startSSOFlow({
            strategy,
            redirectUrl,
            authSessionOptions: { showInRecents: true },
          });

        if (authSessionResult?.type === 'cancel' || authSessionResult?.type === 'dismiss') {
          return;
        }

        // Website continueSignUpUrl="/continue" — finish profile before dashboard.
        if (
          signUp?.status === 'missing_requirements' ||
          (signUp?.missingFields && signUp.missingFields.length > 0)
        ) {
          router.replace({
            pathname: '/(auth)/sso-continue',
            params: { mode },
          });
          return;
        }

        if (createdSessionId && setActive) {
          await finishSession(createdSessionId, setActive);
          return;
        }

        if (signIn?.status === 'needs_second_factor') {
          const hasTotp = signIn.supportedSecondFactors?.some((f) => f.strategy === 'totp');
          router.push({
            pathname: '/(auth)/otp',
            params: { mode: hasTotp ? 'totp' : 'login' },
          });
          return;
        }

        // Incomplete OAuth without a session — same as website /continue.
        if (signUp?.id) {
          router.replace({
            pathname: '/(auth)/sso-continue',
            params: { mode },
          });
          return;
        }

        const message =
          authSessionResult?.type === 'success'
            ? `Could not finish ${provider} sign-in. Check that ${provider} is enabled in Clerk and this redirect URL is allowlisted.`
            : fallback;
        setError(message);
        toast.error(message);
      } catch (err: unknown) {
        if (isSessionAlreadyExistsError(err)) {
          await resumeExistingSession(err);
          return;
        }
        if (needsContinueFlow(err)) {
          router.replace({
            pathname: '/(auth)/sso-continue',
            params: { mode },
          });
          return;
        }
        const message = clerkErrorMessage(err, fallback);
        if (/cancel|dismiss|abort|user.?closed/i.test(message)) {
          return;
        }
        console.error('[ORYNO OAuth] failed', err);
        setError(message);
        toast.error(message);
      } finally {
        setPending(null);
      }
    },
    [finishSession, isSignedIn, mode, resumeExistingSession, startSSOFlow],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.grid}>
        <Pressable
          disabled={pending !== null}
          onPress={() => void startOAuth('oauth_google')}
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.pressed,
            pending !== null && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google">
          {pending === 'oauth_google' ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <GoogleIcon size={20} />
              <Text style={styles.btnText}>Google</Text>
            </>
          )}
        </Pressable>

        <Pressable
          disabled={pending !== null}
          onPress={() => void startOAuth('oauth_apple')}
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.pressed,
            pending !== null && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple">
          {pending === 'oauth_apple' ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <Ionicons name="logo-apple" size={22} color={colors.foreground} />
              <Text style={styles.btnText}>Apple</Text>
            </>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { width: '100%', marginTop: 8 },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerText: { fontSize: 13, color: colors.mutedForeground },
    grid: { flexDirection: 'row', gap: 12 },
    btn: {
      flex: 1,
      height: 52,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    pressed: { backgroundColor: colors.muted, transform: [{ scale: 0.98 }] },
    disabled: { opacity: 0.6 },
    btnText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    error: {
      marginTop: 12,
      textAlign: 'center',
      color: Brand.error,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
