import {
  ensurePhotoLibraryAccessForPicker,
  launchImageLibraryAsync,
} from '@/lib/pick-from-library';
import { useReverification, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OtpInput } from '@/components/auth/otp-input';
import {
  AtSignIcon,
  CameraIcon,
  CheckIcon,
  Globe2Icon,
  MailIcon,
  UserRoundIcon
} from '@/components/icons/lucide-profile-icons';
import { PhoneIcon } from '@/components/icons/lucide-service-icons';
import { Screen } from '@/components/ui/screen';
import { ProfileSkeleton } from '@/components/ui/skeletons';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { api } from '@/lib/api';
import { clerkErrorMessage } from '@/lib/clerk-errors';
import { endpoints } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';
import type { ProfileDto } from '@/lib/types';

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

type EditableField = 'fullName' | 'phone' | 'username' | 'email';

type EmailAddressResource = {
  id: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
  prepareVerification: (params: { strategy: 'email_code' }) => Promise<unknown>;
  attemptVerification: (params: { code: string }) => Promise<EmailAddressResource>;
  destroy: () => Promise<unknown>;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function initialsFrom(name?: string | null) {
  if (!name) return 'OR';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'OR'
  );
}

export default function ProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [enriching, setEnriching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    email: '',
  });
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailObj, setEmailObj] = useState<EmailAddressResource | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const createEmailAddress = useReverification((email: string) =>
    user?.createEmailAddress({ email }),
  );

  const bootstrapFromClerk = useMemo(() => {
    if (!user) return null;
    const fullName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      'ORYNO User';
    const phone =
      (typeof user.unsafeMetadata?.phone === 'string' ? user.unsafeMetadata.phone : null) ||
      user.primaryPhoneNumber?.phoneNumber ||
      null;
    const username =
      user.username ||
      (typeof user.unsafeMetadata?.username === 'string' ? user.unsafeMetadata.username : null);
    const avatarUrl =
      (typeof user.publicMetadata?.avatarUrl === 'string' ? user.publicMetadata.avatarUrl : null) ||
      user.imageUrl;

    return {
      id: user.id,
      clerkId: user.id,
      username,
      fullName,
      email: user.primaryEmailAddress?.emailAddress || '',
      phone,
      avatarUrl,
      countryCode: null,
      countryName: 'Loading…',
      role: 'user',
      kycStatus: 'unverified',
      kycLevel: 0,
      kycLabel: 'Checking…',
      status: 'active',
      dailyLimitLabel: '—',
      emailVerified: Boolean(user.primaryEmailAddress?.verification?.status === 'verified'),
      initials: initialsFrom(fullName),
    } satisfies ProfileDto;
  }, [user]);

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.get<{ profile: ProfileDto }>(endpoints.profile);
      setProfile(data.profile);
      queryClient.setQueryData(queryKeys.profile, { profile: data.profile });
      setForm({
        fullName: data.profile.fullName,
        phone: data.profile.phone || '',
        username: data.profile.username || '',
        email: data.profile.email || '',
      });
    } catch {
      // Keep Clerk bootstrap visible
    } finally {
      setEnriching(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!isLoaded || !user || !bootstrapFromClerk) return;

    setProfile((prev) => prev ?? bootstrapFromClerk);
    setForm((prev) =>
      prev.fullName
        ? prev
        : {
            fullName: bootstrapFromClerk.fullName,
            phone: bootstrapFromClerk.phone || '',
            username: bootstrapFromClerk.username || '',
            email: bootstrapFromClerk.email || '',
          },
    );

    void loadProfile();
    // Depend on user id only — avoid refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

  useEffect(() => {
    if (!verifyingEmail || resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [verifyingEmail, resendSeconds]);

  const { pulling, onRefresh } = usePullRefresh(loadProfile);
  const display = profile || bootstrapFromClerk;

  async function syncProfileFields() {
    const data = await api.patch<{ profile?: ProfileDto; error?: string }>(endpoints.profile, {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      username: form.username.trim(),
    });
    if (!data.profile) {
      throw new Error(data.error || 'Could not save profile');
    }
    setProfile(data.profile);
    queryClient.setQueryData(queryKeys.profile, { profile: data.profile });
    return data.profile;
  }

  async function startEmailChange(nextEmail: string) {
    if (!user) throw new Error('Not signed in');
    const existing = user.emailAddresses.find(
      (e) => normalizeEmail(e.emailAddress) === nextEmail,
    );
    const target = (existing ?? (await createEmailAddress(nextEmail)) ?? null) as
      | EmailAddressResource
      | null;
    if (!target) throw new Error('Could not add that email address.');
    if (target.verification?.status !== 'verified') {
      await target.prepareVerification({ strategy: 'email_code' });
    }
    setEmailObj(target);
    setEmailCode('');
    setVerifyingEmail(true);
    setResendSeconds(45);
  }

  async function saveProfile() {
    if (!user || !display) return;
    const nextEmail = normalizeEmail(form.email);
    const currentEmail = normalizeEmail(display.email || '');
    if (!isValidEmail(nextEmail)) {
      toast.error('Enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      await syncProfileFields();

      if (nextEmail !== currentEmail) {
        await startEmailChange(nextEmail);
        toast.success('We sent a verification code to your new email.');
        return;
      }

      setEditing(false);
      await user.reload();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(clerkErrorMessage(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function verifyEmailCode(code = emailCode) {
    if (!user || !emailObj) return;
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length < 6) {
      toast.error('Enter the 6-digit code from your email.');
      return;
    }
    setEmailBusy(true);
    try {
      let target = emailObj;
      if (target.verification?.status !== 'verified') {
        const result = await target.attemptVerification({ code: cleaned });
        if (result.verification?.status !== 'verified') {
          throw new Error('Invalid or expired verification code.');
        }
        target = result;
      }

      await user.update({ primaryEmailAddressId: target.id });

      const refreshed = await user.reload();
      await Promise.all(
        refreshed.emailAddresses
          .filter((e) => e.id !== target.id)
          .map((e) => e.destroy().catch(() => null)),
      );

      const saved = await syncProfileFields();
      setForm((f) => ({ ...f, email: saved.email }));
      setVerifyingEmail(false);
      setEmailObj(null);
      setEmailCode('');
      setEditing(false);
      await user.reload();
      toast.success('Email updated');
    } catch (err) {
      toast.error(clerkErrorMessage(err, 'Could not verify email'));
    } finally {
      setEmailBusy(false);
    }
  }

  async function resendEmailCode() {
    if (!emailObj || resendSeconds > 0) return;
    setEmailBusy(true);
    try {
      await emailObj.prepareVerification({ strategy: 'email_code' });
      setResendSeconds(45);
      toast.success('Code resent');
    } catch (err) {
      toast.error(clerkErrorMessage(err, 'Could not resend code'));
    } finally {
      setEmailBusy(false);
    }
  }

  function resetEmailVerification() {
    setVerifyingEmail(false);
    setEmailObj(null);
    setEmailCode('');
    setResendSeconds(0);
  }

  function resetForm() {
    if (!display) return;
    setForm({
      fullName: display.fullName,
      phone: display.phone || '',
      username: display.username || '',
      email: display.email || '',
    });
  }

  async function onPickPhoto() {
    if (uploadingAvatar) return;
    const allowed = await ensurePhotoLibraryAccessForPicker();
    if (!allowed) {
      toast.error('Allow photo library access to upload a profile photo.');
      return;
    }

    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) {
      toast.error('Could not read that image. Try another photo.');
      return;
    }
    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > MAX_AVATAR_BYTES) {
      toast.error('Profile photo must be under 4MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const data = await api.patch<{ profile?: ProfileDto; error?: string }>(endpoints.profile, {
        image: {
          filename: asset.fileName || `avatar-${Date.now()}.jpg`,
          mime: asset.mimeType || 'image/jpeg',
          base64,
        },
      });
      if (!data.profile) throw new Error(data.error || 'Could not save avatar');
      setProfile(data.profile);
      queryClient.setQueryData(queryKeys.profile, { profile: data.profile });
      await user?.reload();
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Photo uploaded, but saving failed');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const verified = display?.kycStatus === 'verified' || display?.emailVerified;

  if (!isLoaded || !display) {
    return (
      <Screen
        scroll
        header={
          <View>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.sub}>Manage your ORYNO identity</Text>
          </View>
        }>
        <ProfileSkeleton />
      </Screen>
    );
  }

  const fields: Array<{
    key: EditableField | 'country';
    label: string;
    value: string;
    icon: (color: string) => ReactNode;
  }> = [
    {
      key: 'fullName',
      label: 'Full Name',
      value: display.fullName,
      icon: (color) => <UserRoundIcon color={color} />,
    },
    {
      key: 'username',
      label: 'Username',
      value: display.username ? `@${display.username}` : 'Not set',
      icon: (color) => <AtSignIcon color={color} />,
    },
    {
      key: 'email',
      label: 'Email Address',
      value: display.email,
      icon: (color) => <MailIcon color={color} />,
    },
    {
      key: 'phone',
      label: 'Phone Number',
      value: display.phone || 'Not set',
      icon: (color) => <PhoneIcon size={16} color={color} strokeWidth={1.75} />,
    },
    {
      key: 'country',
      label: 'Country',
      value: enriching ? 'Loading…' : display.countryName,
      icon: (color) => <Globe2Icon color={color} />,
    },
  ];

  return (
    <Screen
      scroll
      refreshing={pulling}
      onRefresh={onRefresh}
      header={
        <View>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.sub}>Manage your ORYNO identity</Text>
        </View>
      }>
      {/* Hero — mirrors website MotionSection profile card */}
      <View style={styles.heroShell}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        />
        <View pointerEvents="none" style={styles.heroGlow} />

        <View style={styles.heroBody}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {display.avatarUrl ? (
                <Image
                  source={{ uri: display.avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{display.initials}</Text>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={Brand.white} />
                </View>
              ) : null}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.cameraBtn,
                uploadingAvatar && { opacity: 0.6 },
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
              onPress={() => void onPickPhoto()}
              disabled={uploadingAvatar}
              accessibilityLabel="Upload profile photo">
              <CameraIcon size={16} color={Brand.white} />
            </Pressable>
          </View>

          <Text style={styles.name}>{display.fullName}</Text>
        </View>
      </View>

      {/* Fields / edit / verify — website profile details card */}
      <View style={styles.card}>
        {verifyingEmail ? (
          <View style={styles.verifyBox}>
            <View style={{ gap: 4 }}>
              <Text style={styles.verifyTitle}>Verify your new email</Text>
              <Text style={styles.verifySub}>
                Enter the 6-digit code we sent to{' '}
                <Text style={styles.verifyEmail}>{normalizeEmail(form.email)}</Text>.
              </Text>
            </View>
            <OtpInput value={emailCode} onChange={setEmailCode} />
            <Text style={styles.resendLine}>
              Didn&apos;t get a code?{' '}
              {resendSeconds > 0 ? (
                <Text style={styles.resendWait}>Resend in {resendSeconds}s</Text>
              ) : (
                <Text
                  style={[styles.resendLink, emailBusy && { opacity: 0.6 }]}
                  onPress={() => {
                    if (!emailBusy) void resendEmailCode();
                  }}>
                  Resend
                </Text>
              )}
            </Text>
          </View>
        ) : editing ? (
          <View style={styles.editForm}>
            <Field
              label="Full Name"
              value={form.fullName}
              onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
              styles={styles}
              colors={colors}
            />
            <Field
              label="Username"
              value={form.username}
              autoCapitalize="none"
              onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
              styles={styles}
              colors={colors}
            />
            <Field
              label="Email Address"
              value={form.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              styles={styles}
              colors={colors}
            />
            <Field
              label="Phone Number"
              value={form.phone}
              keyboardType="phone-pad"
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              styles={styles}
              colors={colors}
            />
            <Text style={styles.editHint}>
              Changing your email sends a verification code to the new address. Your login email
              updates after you verify.
            </Text>
          </View>
        ) : (
          <View>
            {fields.map((field, index) => (
              <View
                key={field.key}
                style={[
                  styles.fieldRow,
                  index < fields.length - 1 && styles.fieldBorder,
                ]}>
                <View style={styles.fieldIcon}>{field.icon(Brand.orange)}</View>
                <View style={styles.fieldCopy}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {field.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {verifyingEmail ? (
          <View style={styles.editActions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                resetEmailVerification();
                resetForm();
              }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (emailBusy || emailCode.length < 6) && { opacity: 0.6 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
              disabled={emailBusy || emailCode.length < 6}
              onPress={() => void verifyEmailCode()}>
              {emailBusy ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <>
                  <CheckIcon size={16} color={Brand.white} />
                  <Text style={styles.saveText}>Verify email</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : editing ? (
          <View style={styles.editActions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                setEditing(false);
                resetEmailVerification();
                resetForm();
              }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                saving && { opacity: 0.6 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
              disabled={saving}
              onPress={() => void saveProfile()}>
              {saving ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <>
                  <CheckIcon size={16} color={Brand.white} />
                  <Text style={styles.saveText}>Save</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              pressed && { transform: [{ translateY: -2 }, { scale: 0.985 }] },
            ]}
            onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
        )}

        <LinkRow label="Settings" onPress={() => router.push('/(app)/settings')} />
        <LinkRow label="Refer & earn" onPress={() => router.push('/(app)/referrals')} />
        <LinkRow
          label="Security & PIN"
          onPress={() => router.push('/(app)/settings/security')}
        />
      </View>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  styles,
  colors,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'style'>) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.grayMedium}
        {...inputProps}
      />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  return (
    <Pressable style={styles.linkRow} onPress={onPress}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  const softShadow = {
    shadowColor: '#1C1C1E',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } as const;

  return StyleSheet.create({
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    sub: {
      color: colors.mutedForeground,
      marginTop: 2,
      fontSize: 14,
      fontWeight: '400',
    },
    heroShell: {
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...softShadow,
    },
    heroBanner: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 112,
    },
    heroGlow: {
      position: 'absolute',
      top: -20,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    heroBody: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 20,
    },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 999,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: colors.background,
      shadowColor: Brand.orange,
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 4,
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { color: Brand.orange, fontSize: 24, fontWeight: '700' },
    avatarOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraBtn: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Brand.charcoal,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: colors.background,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    name: {
      marginTop: 16,
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    username: {
      marginTop: 4,
      fontSize: 14,
      color: colors.mutedForeground,
      fontWeight: '400',
    },
    badges: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeVerified: { backgroundColor: 'rgba(52,199,89,0.12)' },
    badgeMuted: { backgroundColor: colors.muted },
    badgeText: { fontSize: 12, fontWeight: '600' },
    countryBadge: {
      borderRadius: 999,
      backgroundColor: colors.orangeMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countryText: { fontSize: 12, fontWeight: '600', color: Brand.orange },
    card: {
      marginTop: 20,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 0,
      paddingVertical: 14,
    },
    fieldBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    fieldIcon: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldCopy: { flex: 1, minWidth: 0 },
    fieldLabel: { fontSize: 12, color: colors.mutedForeground },
    fieldValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    verifyBox: { paddingVertical: 4, gap: 16 },
    verifyTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    verifySub: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20 },
    verifyEmail: { fontWeight: '600', color: colors.foreground },
    resendLine: { textAlign: 'center', fontSize: 14, color: colors.mutedForeground },
    resendWait: { fontWeight: '600', color: colors.foreground },
    resendLink: { fontWeight: '600', color: Brand.orange },
    editForm: { paddingVertical: 4, gap: 16 },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    input: {
      marginTop: 8,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: isDark ? 'rgba(23,23,27,0.4)' : 'rgba(245,245,247,0.4)',
      paddingHorizontal: 16,
      fontSize: 16,
      color: colors.foreground,
    },
    editHint: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 17,
    },
    actions: { marginTop: 20, gap: 12, marginBottom: 16 },
    editBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Brand.orange,
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    editBtnText: { color: Brand.white, fontSize: 16, fontWeight: '600' },
    editActions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Brand.orange,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { color: Brand.orange, fontSize: 14, fontWeight: '600' },
    saveBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: Brand.orange,
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    saveText: { color: Brand.white, fontSize: 14, fontWeight: '600' },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 14,
      ...softShadow,
    },
    linkLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  });
}
