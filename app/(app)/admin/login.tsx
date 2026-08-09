import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { adminLogin, ApiError, fetchAdminMe } from '@/lib/admin/api';

export default function AdminLoginScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { user } = useUser();
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      '',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAdminMe();
        if (cancelled) return;
        if (me.email) setEmail(me.email);
        setCanBootstrap(Boolean(me.canBootstrap));
        setAdminRole(me.admin?.role ?? null);
        if (me.session && me.isAdmin) {
          router.replace('/(app)/admin' as never);
          return;
        }
        if (!me.isAdmin && !me.canBootstrap) {
          setDenied(me.reason !== 'inactive');
          setInactive(me.reason === 'inactive');
        }
      } catch {
        // stay on login
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit() {
    setError('');
    setLoading(true);
    try {
      await adminLogin(passcode.trim());
      router.replace('/(app)/admin' as never);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to unlock admin',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ['#1A120C', colors.background, colors.muted] : ['#FFF7F0', '#FFFFFF', '#F5F5F7']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            <Text style={styles.backText}>Back to app</Text>
          </Pressable>

          <Animated.View entering={FadeInDown.duration(420).springify().damping(18)} style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.logoWell}>
                <Image
                  source={require('@/assets/images/oryno-icon.png')}
                  style={styles.logo}
                  contentFit="cover"
                />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brand}>ORYNO Admin</Text>
                <Text style={styles.brandSub}>Clerk account + admin passcode</Text>
              </View>
            </View>

            {checking ? (
              <View style={styles.checking}>
                <ActivityIndicator color={Brand.orange} />
                <Text style={styles.muted}>Checking access…</Text>
              </View>
            ) : denied || inactive ? (
              <Animated.View entering={FadeIn.duration(280)} style={styles.stateBox}>
                <View style={styles.stateIcon}>
                  <Ionicons name="shield-outline" size={22} color={Brand.error} />
                </View>
                <Text style={styles.stateTitle}>
                  {inactive ? 'Admin disabled' : 'Not an admin'}
                </Text>
                <Text style={styles.stateBody}>
                  {inactive
                    ? 'This admin account has been deactivated.'
                    : 'Your account is not an admin. Ask a super admin to add your email to the admins list.'}
                </Text>
                {email ? (
                  <Text style={styles.signedAs}>Signed in as {email}</Text>
                ) : null}
                <Button
                  title="Back to app"
                  variant="secondary"
                  onPress={() => router.replace('/(app)/(tabs)' as never)}
                  style={{ marginTop: 12 }}
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(280)}>
                <View style={styles.callout}>
                  <View style={styles.calloutHead}>
                    <Ionicons name="shield-checkmark" size={16} color={Brand.orange} />
                    <Text style={styles.calloutTitle}>Secure admin entry</Text>
                  </View>
                  <Text style={styles.calloutBody}>
                    {canBootstrap
                      ? 'Your email is on the admin allowlist. Enter the passcode to activate access.'
                      : 'Enter the admin passcode to unlock the console.'}
                  </Text>
                  {email ? (
                    <Text style={styles.calloutEmail}>
                      {email}
                      {adminRole ? ` · ${adminRole.replace(/_/g, ' ')}` : ''}
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.label}>Admin passcode</Text>
                <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
                  <Ionicons name="key-outline" size={20} color={colors.mutedForeground} />
                  <TextInput
                    value={passcode}
                    onChangeText={(v) => {
                      setPasscode(v);
                      if (error) setError('');
                    }}
                    secureTextEntry={!showPasscode}
                    placeholder="Enter passcode"
                    placeholderTextColor={colors.mutedForeground}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    editable={!loading}
                    onSubmitEditing={onSubmit}
                    returnKeyType="go"
                  />
                  <Pressable
                    onPress={() => setShowPasscode((v) => !v)}
                    hitSlop={8}
                    accessibilityLabel={showPasscode ? 'Hide passcode' : 'Show passcode'}>
                    <Ionicons
                      name={showPasscode ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>

                {error ? (
                  <Text style={styles.error}>{error}</Text>
                ) : (
                  <Text style={styles.hint}>
                    Passcode is set with <Text style={styles.hintStrong}>ADMIN_PASSCODE</Text> on
                    the server.
                  </Text>
                )}

                <Button
                  title={loading ? 'Unlocking…' : 'Unlock admin'}
                  onPress={onSubmit}
                  loading={loading}
                  disabled={passcode.trim().length < 4}
                  style={{ marginTop: 12 }}
                />
              </Animated.View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 12 },
  glowTop: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,106,0,0.16)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,140,66,0.12)',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    shadowColor: '#0F0F12',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoWell: {
    width: 48,
    height: 48,
    borderRadius: 999,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandCopy: { flex: 1, minWidth: 0 },
  brand: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  brandSub: { marginTop: 2, fontSize: 13, color: colors.mutedForeground, fontWeight: '500' },
  checking: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  muted: { fontSize: 13, color: colors.mutedForeground },
  callout: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: colors.orangeMuted,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
  },
  calloutHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  calloutBody: { fontSize: 12, color: colors.mutedForeground, lineHeight: 17 },
  calloutEmail: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
  },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  inputWrap: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
  },
  inputWrapError: {
    borderColor: 'rgba(255,59,48,0.45)',
    backgroundColor: 'rgba(255,59,48,0.04)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.foreground,
    paddingVertical: 10,
  },
  error: { marginTop: 10, color: Brand.error, fontSize: 13, fontWeight: '600' },
  hint: { marginTop: 10, fontSize: 12, color: colors.mutedForeground, lineHeight: 17 },
  hintStrong: { fontWeight: '700', color: colors.foreground },
  stateBox: { marginTop: 14, alignItems: 'center' },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  signedAs: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
  },
});
}

