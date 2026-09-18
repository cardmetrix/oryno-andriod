import { useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { continueAfterSignedIn, syncSessionToDatabase } from '@/lib/auth-sync';
import { clerkErrorMessage } from '@/lib/clerk-errors';
import { applyMissingSignUpFields } from '@/lib/complete-signup';
import {
  normalizeReferralCode,
  persistReferralCode,
  readStoredReferralCode,
} from '@/lib/referrals';
import { toast } from '@/lib/toast';
import { isValidUsername, normalizeUsername } from '@/lib/username';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Website `/continue` equivalent — collect username / name / phone when Clerk
 * still needs fields after email OTP or Google/Apple OAuth.
 */
export default function SsoContinueScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { isLoaded, signUp, setActive } = useSignUp();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = firstParam(params.mode) === 'signUp' ? 'signUp' : 'signIn';

  const missing = useMemo(
    () => new Set((signUp?.missingFields ?? []).filter(Boolean)),
    [signUp?.missingFields],
  );

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (signUp?.status === 'complete' && signUp.createdSessionId && setActive) {
      void (async () => {
        await setActive({ session: signUp.createdSessionId! });
        try {
          const referral = await readStoredReferralCode();
          const sync = await syncSessionToDatabase({
            announceLogin: mode === 'signIn',
            referralCode: referral || undefined,
          });
          await continueAfterSignedIn(sync);
        } catch {
          await continueAfterSignedIn(null);
        }
      })();
      return;
    }

    if (signUp?.username) setUsername(signUp.username);
    const name = [signUp?.firstName, signUp?.lastName].filter(Boolean).join(' ');
    if (name) setFullName(name);
    if (signUp?.phoneNumber) setPhone(signUp.phoneNumber);
  }, [
    isLoaded,
    mode,
    setActive,
    signUp,
    signUp?.createdSessionId,
    signUp?.firstName,
    signUp?.lastName,
    signUp?.phoneNumber,
    signUp?.status,
    signUp?.username,
  ]);

  const needsPhone = missing.has('phone_number');
  const canSubmit =
    agreed &&
    isLoaded &&
    !loading &&
    Boolean(signUp) &&
    isValidUsername(normalizeUsername(username)) &&
    fullName.trim().length >= 2 &&
    (!needsPhone || phone.trim().length >= 7);

  const onSubmit = async () => {
    if (!isLoaded || !signUp || !setActive || !canSubmit) return;

    setLoading(true);
    setError(null);
    try {
      const storedReferral = normalizeReferralCode(await readStoredReferralCode());
      if (storedReferral) await persistReferralCode(storedReferral);

      const result = await applyMissingSignUpFields(signUp, {
        username: normalizeUsername(username),
        fullName: fullName.trim(),
        phone: phone.trim(),
        legalAccepted: agreed,
      });

      if (result.status === 'complete') {
        const sessionId =
          (result as { createdSessionId?: string | null }).createdSessionId ??
          signUp.createdSessionId;
        if (!sessionId) {
          setError('Account ready, but no session was created.');
          return;
        }
        await setActive({ session: sessionId });
        const sync = await syncSessionToDatabase({
          announceLogin: mode === 'signIn',
          referralCode: storedReferral || undefined,
        });
        toast.success('Welcome to ORYNO');
        await continueAfterSignedIn(sync);
        return;
      }

      const stillMissing = (result.missingFields ?? []).join(', ');
      setError(
        stillMissing
          ? `Still need: ${stillMissing.replace(/_/g, ' ')}.`
          : 'Could not finish account setup. Try again.',
      );
    } catch (err: unknown) {
      const message = clerkErrorMessage(err, 'Could not finish account setup. Try again.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoaded && !signUp) {
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
          <Text style={styles.title}>Continue setup</Text>
          <Text style={styles.sub}>
            No active sign-up was found. Sign in again or create a new account.
          </Text>
        </View>
        <View style={styles.form}>
          <Button title="Sign in" onPress={() => router.replace('/(auth)/login')} />
          <Button
            title="Create account"
            variant="secondary"
            onPress={() => router.replace('/(auth)/register')}
          />
        </View>
      </Screen>
    );
  }

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
        <Text style={styles.title}>Additional information</Text>
        <Text style={styles.sub}>
          A few details are required to finish creating your ORYNO account.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="e.g. Chidi Benson"
          autoComplete="name"
        />
        <TextField
          label="Username"
          value={username}
          onChangeText={(v) => setUsername(v.replace(/\s+/g, '').toLowerCase())}
          placeholder="e.g. chidi_b"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
        />
        {needsPhone ? (
          <TextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. +234 801 234 5678"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        ) : null}

        <Pressable
          style={styles.agreeRow}
          onPress={() => setAgreed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: agreed ? Brand.orange : colors.border,
                backgroundColor: agreed ? Brand.orange : 'transparent',
              },
            ]}>
            {agreed ? <Ionicons name="checkmark" size={14} color={Brand.white} /> : null}
          </View>
          <Text style={[styles.agreeText, { color: colors.mutedForeground }]}>
            I agree to the{' '}
            <Link href="/(auth)/terms" asChild>
              <Text style={styles.linkInline}>Terms of Service</Text>
            </Link>{' '}
            &{' '}
            <Link href="/(auth)/privacy" asChild>
              <Text style={styles.linkInline}>Privacy Policy</Text>
            </Link>
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={loading ? 'Finishing…' : 'Continue'}
          loading={loading}
          disabled={!canSubmit}
          onPress={() => void onSubmit()}
        />
        <Button
          title="Back to sign in"
          variant="secondary"
          onPress={() => router.replace('/(auth)/login')}
        />
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
    title: { fontSize: 26, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 12 },
    form: { gap: 14 },
    agreeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingTop: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    agreeText: { flex: 1, fontSize: 13, lineHeight: 19 },
    linkInline: { color: Brand.orange, fontWeight: '700', fontSize: 13 },
    error: {
      color: Brand.error,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}
