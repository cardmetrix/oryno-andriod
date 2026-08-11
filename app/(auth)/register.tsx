import { useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SocialAuth } from '@/components/auth/social-auth';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import {
  normalizeReferralCode,
  persistReferralCode,
  readStoredReferralCode,
} from '@/lib/referrals';
import { isValidUsername, normalizeUsername } from '@/lib/username';

export default function RegisterScreen() {
  const { signUp, isLoaded } = useSignUp();
  const { colors } = useAppTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void readStoredReferralCode().then((code) => {
      if (code) setReferralCode(code);
    });
  }, []);

  const onContinue = async () => {
    if (!isLoaded || !signUp) return;
    if (!fullName || !username || !email || !password) {
      alert.warning('Missing fields', 'Please complete all required fields.');
      return;
    }
    const nextUsername = normalizeUsername(username);
    if (!isValidUsername(nextUsername)) {
      alert.warning(
        'Invalid username',
        'Use 3–32 characters: letters, numbers, and underscores.',
      );
      return;
    }
    if (password !== confirm) {
      alert.warning('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (!agreed) {
      alert.warning(
        'Agreement required',
        'Please agree to the Terms of Service and Privacy Policy.',
      );
      return;
    }

    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? fullName;
    const lastName = parts.slice(1).join(' ') || firstName;
    const referral = normalizeReferralCode(referralCode);
    if (referral) await persistReferralCode(referral);

    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName,
        lastName,
        username: nextUsername,
        unsafeMetadata: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          legalAccepted: true,
          ...(referral ? { referralCode: referral } : {}),
        },
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
          label="Username"
          value={username}
          onChangeText={(v) => setUsername(v.replace(/\s+/g, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholder="chidi_ok"
        />
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
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          placeholder="••••••••"
        />
        <TextField
          label="Confirm Password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          secureToggle
          placeholder="••••••••"
        />
        <TextField
          label="Referral code (optional)"
          value={referralCode}
          onChangeText={(v) => setReferralCode(v.toUpperCase())}
          autoCapitalize="characters"
          placeholder="e.g. AB12CD34"
        />

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
            {agreed ? (
              <Ionicons name="checkmark" size={14} color={Brand.white} />
            ) : null}
          </View>
          <Text style={[styles.agreeText, { color: colors.mutedForeground }]}>
            I agree to the{' '}
            <Text
              style={styles.linkInline}
              onPress={() => router.push('/(auth)/terms')}>
              Terms of Service
            </Text>{' '}
            &{' '}
            <Text
              style={styles.linkInline}
              onPress={() => router.push('/(auth)/privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </Pressable>

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
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  logo: { width: '100%', height: '100%', borderRadius: 999 },
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 12 },
  form: { gap: 12 },
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 14 },
  link: { color: Brand.orange, fontWeight: '700', fontSize: 14 },
  linkInline: { color: Brand.orange, fontWeight: '700', fontSize: 13 },
});
