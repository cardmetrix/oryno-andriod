import { useSignUp } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { syncSessionToDatabase } from '@/lib/auth-sync';
import { toast } from '@/lib/toast';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Completes Google/Apple sign-up when Clerk requires extra fields
 * (username, first/last name, etc.).
 */
export default function SsoContinueScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { isLoaded, signUp, setActive } = useSignUp();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = firstParam(params.mode) === 'signUp' ? 'signUp' : 'signIn';

  const missing = useMemo(
    () => (signUp?.missingFields ?? []).filter(Boolean),
    [signUp?.missingFields],
  );

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!signUp?.id) {
      router.replace('/(auth)/login');
      return;
    }
    if (signUp.status === 'complete' && signUp.createdSessionId && setActive) {
      void (async () => {
        await setActive({ session: signUp.createdSessionId! });
        try {
          await syncSessionToDatabase({ announceLogin: mode === 'signIn' });
        } catch {
          // ignore
        }
        router.replace('/(app)/(tabs)');
      })();
    }
  }, [isLoaded, mode, setActive, signUp?.createdSessionId, signUp?.id, signUp?.status]);

  const needsName =
    missing.includes('first_name') ||
    missing.includes('last_name') ||
    missing.length === 0;
  const needsUsername = missing.includes('username');

  const onSubmit = async () => {
    if (!isLoaded || !signUp || !setActive) return;

    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || firstName;
    const nextUsername =
      username.trim() ||
      signUp.emailAddress?.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) ||
      `user${Date.now() % 100000}`;

    if (needsName && !firstName) {
      setError('Enter your full name to continue.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signUp.update({
        ...(needsName || missing.includes('first_name')
          ? { firstName }
          : {}),
        ...(needsName || missing.includes('last_name')
          ? { lastName: lastName || firstName }
          : {}),
        ...(needsUsername || missing.includes('username')
          ? { username: nextUsername }
          : {}),
        ...(fullName.trim()
          ? {
              unsafeMetadata: {
                ...(typeof signUp.unsafeMetadata === 'object' &&
                signUp.unsafeMetadata
                  ? signUp.unsafeMetadata
                  : {}),
                fullName: fullName.trim(),
              },
            }
          : {}),
      });

      if (signUp.status === 'complete' && signUp.createdSessionId) {
        await setActive({ session: signUp.createdSessionId });
        try {
          await syncSessionToDatabase({ announceLogin: mode === 'signIn' });
        } catch {
          // ignore
        }
        toast.success('Welcome to ORYNO');
        router.replace('/(app)/(tabs)');
        return;
      }

      setError(
        signUp.missingFields?.length
          ? `Still needed: ${signUp.missingFields.join(', ')}`
          : `Sign-up incomplete (${signUp.status}). Try email instead.`,
      );
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err && 'errors' in err
          ? String(
              (err as { errors?: { message?: string }[] }).errors?.[0]?.message ??
                'Could not finish Google sign-up',
            )
          : 'Could not finish Google sign-up';
      setError(message);
      toast.error(message);
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
        <Text style={styles.title}>Finish your account</Text>
        <Text style={styles.sub}>
          One more step to complete Google sign-in
        </Text>
      </View>

      <View style={styles.form}>
        {needsName ? (
          <TextField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Chidi Okechukwu"
            autoComplete="name"
          />
        ) : null}
        {needsUsername ? (
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="chidi"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Continue" loading={loading} onPress={() => void onSubmit()} />
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
      borderRadius: Radius.sm,
      overflow: 'hidden',
      marginBottom: 8,
    },
    logo: { width: '100%', height: '100%' },
    title: { fontSize: 26, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
    form: { gap: 14 },
    error: {
      color: Brand.error,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}
