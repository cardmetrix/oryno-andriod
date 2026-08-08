import { useSignUp } from '@clerk/clerk-expo';
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

export default function RegisterScreen() {
  const { signUp, isLoaded } = useSignUp();
  const { colors } = useAppTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    if (!isLoaded || !signUp) return;
    if (!fullName || !email || !password) {
      alert.warning('Missing fields', 'Please complete all required fields.');
      return;
    }
    if (password !== confirm) {
      alert.warning('Password mismatch', 'Passwords do not match.');
      return;
    }

    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? fullName;
    const lastName = parts.slice(1).join(' ') || firstName;
    const username =
      email.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || `user${Date.now() % 100000}`;

    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName,
        lastName,
        username,
        unsafeMetadata: { fullName: fullName.trim(), phone: phone.trim() },
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      router.push({
        pathname: '/(auth)/otp',
        params: { mode: 'register', email: email.trim() },
      });
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'errors' in e
          ? String((e as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Sign up failed')
          : 'Sign up failed';
      alert.error('Sign up failed', msg);
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
        <Text style={[styles.title, { color: colors.foreground }]}>Create Account</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Join ORYNO and enjoy simplified digital services
        </Text>
      </View>

      <View style={styles.form}>
        <TextField label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Chidi Okechukwu" />
        <TextField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@email.com"
        />
        <TextField
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+234 801 234 5678"
        />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <TextField
          label="Confirm Password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="••••••••"
        />
        <Button title="Continue" onPress={onContinue} loading={loading} />
        <SocialAuth mode="signUp" />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Already have an account?{' '}
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={styles.link}>Sign In</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 22, gap: 8 },
  logoWell: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginBottom: 6,
  },
  logo: { width: '100%', height: '100%' },
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 12 },
  form: { gap: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 14 },
  link: { color: Brand.orange, fontWeight: '700', fontSize: 14 },
});
