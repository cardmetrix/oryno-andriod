import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Screen } from '@/components/ui/screen';
import { ProfileSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { APP_VERSION_LABEL } from '@/lib/app-version';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { unregisterPushToken } from '@/lib/push-notifications';
import { queryKeys } from '@/lib/query-keys';
import type { ProfileDto } from '@/lib/types';

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signOut } = useAuth();
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [enriching, setEnriching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', username: '' });

  const bootstrapFromClerk = useMemo(() => {
    if (!user) return null;
    const fullName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      'ORYNO User';
    const phone = user.primaryPhoneNumber?.phoneNumber || null;
    const username = user.username || null;
    const metaAvatar =
      typeof user.publicMetadata?.avatarUrl === 'string'
        ? user.publicMetadata.avatarUrl
        : null;
    const avatarUrl = metaAvatar || user.imageUrl || null;

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
      kycStatus: 'unverified',
      kycLevel: 0,
      kycLabel: 'Checking…',
      status: 'active',
      dailyLimitLabel: '—',
      emailVerified: false,
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
          },
    );
    void loadProfile();
  }, [isLoaded, user?.id, bootstrapFromClerk, loadProfile]);

  const { pulling, onRefresh } = usePullRefresh(loadProfile);

  const display = profile || bootstrapFromClerk;

  async function saveProfile() {
    setSaving(true);
    try {
      const data = await api.patch<{ profile?: ProfileDto; error?: string }>(
        endpoints.profile,
        {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          username: form.username.trim(),
        },
      );
      if (!data.profile) throw new Error(data.error || 'Could not save profile');
      setProfile(data.profile);
      queryClient.setQueryData(queryKeys.profile, { profile: data.profile });
      setEditing(false);
      await user?.reload();
      alert.success('Saved', 'Your profile has been updated.');
    } catch (err) {
      alert.error('Error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onPickPhoto() {
    if (uploadingAvatar) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert.error('Permission needed', 'Allow photo library access to upload a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
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
      alert.error('Upload failed', 'Could not read that image. Try another photo.');
      return;
    }
    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > MAX_AVATAR_BYTES) {
      alert.error('Too large', 'Profile photo must be under 4MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const data = await api.patch<{ profile?: ProfileDto; error?: string }>(
        endpoints.profile,
        {
          image: {
            filename: asset.fileName || `avatar-${Date.now()}.jpg`,
            mime: asset.mimeType || 'image/jpeg',
            base64,
          },
        },
      );
      if (!data.profile) throw new Error(data.error || 'Could not save photo');
      setProfile(data.profile);
      queryClient.setQueryData(queryKeys.profile, { profile: data.profile });
      await user?.reload();
      alert.success('Updated', 'Profile photo updated.');
    } catch (err) {
      alert.error(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload profile photo.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  const verified = display?.kycStatus === 'verified' || display?.emailVerified;
  const countryInfo = getCountryInfo(display?.countryCode);
  const countryLabel =
    enriching && !display?.countryCode
      ? 'Loading…'
      : display?.countryName && display.countryName !== 'Loading…'
        ? display.countryName
        : countryInfo.name;

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

  const fields = [
    {
      key: 'fullName',
      label: 'Full Name',
      value: display.fullName,
      icon: 'person-outline' as const,
    },
    {
      key: 'username',
      label: 'Username',
      value: display.username ? `@${display.username}` : 'Not set',
      icon: 'at-outline' as const,
    },
    {
      key: 'email',
      label: 'Email Address',
      value: display.email || 'Not set',
      icon: 'mail-outline' as const,
    },
    {
      key: 'phone',
      label: 'Phone Number',
      value: display.phone || 'Not set',
      icon: 'call-outline' as const,
    },
    {
      key: 'country',
      label: 'Country',
      value: enriching && !display.countryCode
        ? 'Loading…'
        : `${countryInfo.flagEmoji}  ${countryLabel}${
            display.countryCode || countryInfo.code
              ? ` · ${display.countryCode || countryInfo.code}`
              : ''
          }`,
      icon: 'globe-outline' as const,
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
      {/* Hero — matches website orange banner + avatar */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.heroShell}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        />
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
              style={[styles.cameraBtn, uploadingAvatar && { opacity: 0.6 }]}
              onPress={() => void onPickPhoto()}
              disabled={uploadingAvatar}
              accessibilityLabel="Upload profile photo">
              <Ionicons name="camera" size={16} color={Brand.white} />
            </Pressable>
          </View>

          <Text style={styles.name}>{display.fullName}</Text>
          {display.username ? <Text style={styles.username}>@{display.username}</Text> : null}

          <View style={styles.badges}>
            <View
              style={[
                styles.badge,
                verified ? styles.badgeVerified : styles.badgeMuted,
              ]}>
              <Ionicons
                name={verified ? 'checkmark-circle' : 'shield-checkmark-outline'}
                size={13}
                color={verified ? Brand.success : colors.grayMedium}
              />
              <Text
                style={[
                  styles.badgeText,
                  verified ? { color: Brand.success } : { color: colors.grayMedium },
                ]}>
                {enriching ? 'Syncing…' : display.kycLabel}
              </Text>
            </View>
            <View
              style={styles.countryBadge}
              accessibilityLabel={`Country ${countryLabel}`}>
              <Text style={styles.countryFlag}>{countryInfo.flagEmoji}</Text>
              <Text style={styles.countryText} numberOfLines={1}>
                {countryLabel}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Details / Edit */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.card}>
        {editing ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.editForm}>
            <FieldLabel label="Full Name" />
            <TextInput
              value={form.fullName}
              onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
              style={styles.input}
              placeholderTextColor={colors.grayMedium}
            />
            <FieldLabel label="Username" />
            <TextInput
              value={form.username}
              onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor={colors.grayMedium}
            />
            <FieldLabel label="Phone Number" />
            <TextInput
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
              style={styles.input}
              placeholderTextColor={colors.grayMedium}
            />
            <Text style={styles.editHint}>
              Email is managed by your Clerk login and can’t be edited here.
            </Text>
          </Animated.View>
        ) : (
          <View>
            {fields.map((field, index) => (
              <Animated.View
                key={field.key}
                entering={FadeInDown.delay(40 + index * 30).duration(240)}
                style={[styles.fieldRow, index > 0 && styles.fieldBorder]}>
                <View style={styles.fieldIcon}>
                  <Ionicons name={field.icon} size={18} color={Brand.orange} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {field.value}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={styles.limitBar}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.limitLabel}>Account Limit Status</Text>
            <Text style={styles.limitValue}>
              {enriching ? 'Updating limits…' : `${display.dailyLimitLabel} daily`}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(app)/settings/levels')}>
            <Text style={styles.limitLink}>View Levels</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.actions}>
        {editing ? (
          <View style={styles.editActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                setEditing(false);
                setForm({
                  fullName: display.fullName,
                  phone: display.phone || '',
                  username: display.username || '',
                });
              }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              onPress={() => void saveProfile()}>
              {saving ? (
                <Text style={styles.saveText}>Saving…</Text>
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={Brand.white} />
                  <Text style={styles.saveText}>Save</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
        )}

        <LinkRow
          label="Refer & Earn"
          onPress={() => router.push('/(app)/referrals')}
        />
        <LinkRow label="Settings" onPress={() => router.push('/(app)/settings')} />
        <LinkRow
          label="Security & PIN"
          onPress={() => router.push('/(app)/settings/security')}
        />
        <LinkRow
          label="Support"
          onPress={() => router.push('/(app)/support')}
        />
        <LinkRow
          label="Terms of Service"
          onPress={() => router.push('/(app)/terms')}
        />
        <LinkRow
          label="Privacy Policy"
          onPress={() => router.push('/(app)/privacy')}
        />
        <LinkRow
          label="Notifications"
          onPress={() => router.push('/(app)/notifications')}
        />

        <Pressable
          style={styles.signOutBtn}
          onPress={() => {
            alert.confirm('Sign out?', 'You can sign back in anytime.', {
              confirmLabel: 'Sign Out',
              destructive: true,
              onConfirm: async () => {
                try {
                  await unregisterPushToken().catch(() => null);
                  await api.post(endpoints.auth.logout).catch(() => null);
                } finally {
                  await signOut();
                  router.replace('/(auth)/login');
                }
              },
            });
          }}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.versionText}>ORYNO {APP_VERSION_LABEL}</Text>
      </Animated.View>
    </Screen>
  );
}

function FieldLabel({ label }: { label: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.inputLabel}>{label}</Text>;
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
      onPress={onPress}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.grayMedium} />
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.charcoal,
    marginTop: 0,
    letterSpacing: -0.4,
  },
  sub: {
    color: colors.grayMedium,
    marginBottom: 0,
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  heroShell: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    overflow: 'hidden',
    shadowColor: '#0F0F12',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroBanner: { height: 104 },
  heroBody: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    marginTop: -48,
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
    borderColor: colors.card,
    shadowColor: Brand.orange,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: Brand.orange, fontSize: 32, fontWeight: '800' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  name: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  username: {
    marginTop: 4,
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
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
    paddingVertical: 6,
  },
  badgeVerified: { backgroundColor: 'rgba(52,199,89,0.12)' },
  badgeMuted: { backgroundColor: colors.muted },
  badgeText: { fontSize: 12, fontWeight: '700' },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.orangeMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 180,
  },
  countryFlag: { fontSize: 14 },
  countryText: { fontSize: 12, fontWeight: '700', color: Brand.orange, flexShrink: 1 },
  card: {
    marginTop: 12,
    borderRadius: Radius.card,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  fieldValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  editForm: { padding: 12, gap: 4 },
  inputLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  input: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  editHint: {
    marginTop: 12,
    fontSize: 12,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  limitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grayDivider,
    backgroundColor: 'rgba(255,106,0,0.08)',
  },
  limitLabel: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  limitValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal,
  },
  limitLink: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  actions: { marginTop: 12, gap: 10 },
  editBtn: {
    height: 44,
    borderRadius: 16,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.charcoal, fontSize: 15, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: Brand.orange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  linkLabel: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
  signOutBtn: {
    marginTop: 4,
    marginBottom: 16,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { color: Brand.error, fontSize: 15, fontWeight: '700' },
  versionText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
});
}

