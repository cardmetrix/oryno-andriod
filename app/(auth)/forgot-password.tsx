import { useSignIn } from '@clerk/clerk-expo';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OtpInput } from '@/components/auth/otp-input';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { continueAfterSignedIn, syncSessionToDatabase } from '@/lib/auth-sync';
import { getBiometricMeta } from '@/lib/biometric';
import { saveBiometricLogin } from '@/lib/biometric-login';

export default function ForgotPasswordScreen() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!isLoaded || !signIn) return;
    if (!email) {
      alert.warning('Email required');
      return;
    }
    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setPending(true);
      alert.info('Check your inbox', 'Enter the reset code and your new password.');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'errors' in e
          ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Failed')
          : 'Failed to send reset code';
      alert.error('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded || !signIn || !setActive) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        const hardware = await getBiometricMeta();
        if (hardware.available) {
          await saveBiometricLogin(email.trim(), password);
        }
        alert.success('Password updated', 'You are now signed in.', () => {
          void (async () => {
            try {
              const sync = await syncSessionToDatabase({ announceLogin: true });
              await continueAfterSignedIn(sync);
            } catch {
              await continueAfterSignedIn(null);
            }
          })();
        });
      } else {
        alert.warning('Incomplete', `Status: ${result.status}`);
      }
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'errors' in e
          ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Failed')
          : 'Reset failed';
      alert.error('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      scroll
      header={<PageHeader title="Forgot Password" subtitle="Reset via email code" />}>
      <View style={styles.form}>
        {!pending ? (
          <>
            <TextField
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@email.com"
            />
            <Button title="Send Reset Code" onPress={sendCode} loading={loading} />
          </>
        ) : (
          <>
            <Text style={[styles.codeLabel, { color: colors.foreground }]}>Reset code</Text>
            <OtpInput value={code} onChange={setCode} />
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
              placeholder="••••••••"
            />
            <Button
              title="Update Password"
              onPress={resetPassword}
              loading={loading}
              disabled={code.length < 6 || !password}
            />
          </>
        )}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Powered by Clerk · same accounts as orynoafrica.com
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, marginTop: 8 },
  codeLabel: { fontSize: 13, fontWeight: '600', marginBottom: -4 },
  hint: { textAlign: 'center', fontSize: 12 },
});
