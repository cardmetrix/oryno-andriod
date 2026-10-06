import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { SettingsSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius } from '@/constants/theme';
import { usePushNotifications } from '@/context/push-notification-context';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { registerPushToken, setAppBadge } from '@/lib/push-notifications';
import { toast } from '@/lib/toast';
import type { ProfileDto } from '@/lib/types';

type SettingsPayload = {
  profile: ProfileDto;
  preferences: {
    theme: 'light' | 'dark' | 'system' | string;
    language: string;
    notificationsEnabled: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    biometricEnabled: boolean;
    hasPin: boolean;
  };
};

const SETTINGS_HERO_BG = require('@/assets/images/settings-hero-bg.png');

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { setPreferenceEnabled, clearPushRegistration } = usePushNotifications();
  const { preference, setPreference, colors } = useAppTheme();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<SettingsPayload>(endpoints.settings.root);
      setData(json);
      // Do not apply API theme here — the live toggle owns local theme.
      // Overwriting on load caused a visible light/dark glitch.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(
    body: Record<string, unknown>,
    successToast?: string,
  ) {
    setSaving(true);
    try {
      if (body.theme === 'dark' || body.theme === 'light') {
        await setPreference(body.theme);
      }
      const json = await api.patch<Partial<SettingsPayload> & { error?: string }>(
        endpoints.settings.root,
        body,
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              preferences: (json.preferences as SettingsPayload['preferences']) ?? prev.preferences,
              security: (json.security as SettingsPayload['security']) ?? prev.security,
              profile: (json.profile as ProfileDto) ?? prev.profile,
            }
          : prev,
      );
      if (successToast) toast.success(successToast);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <Screen
        scroll
        header={
          <PageHeader
            title="Settings"
            subtitle="Preferences, security, and support"
            showBack
          />
        }>
        <SettingsSkeleton />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen
        scroll
        header={<PageHeader title="Settings" showBack />}>
        <View
          style={[
            styles.errorCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Couldn’t load settings
          </Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen
        scroll
        header={
          <PageHeader
            title="Settings"
            subtitle="Preferences, security, and support"
            showBack
          />
        }>
        <SettingsSkeleton />
      </Screen>
    );
  }

  const darkMode = preference === 'dark';
  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={load}
      header={
        <PageHeader
          title="Settings"
          subtitle="Preferences, security, and support"
          showBack
        />
      }>
      <View style={styles.accountHeroWrap}>
        <ImageBackground
          source={SETTINGS_HERO_BG}
          resizeMode="cover"
          imageStyle={styles.accountHeroImage}
          style={styles.accountHero}>
          <View style={styles.accountTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.accountEyebrow}>ACCOUNT</Text>
              <Text style={styles.accountName} numberOfLines={1}>
                {data.profile.fullName}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {data.profile.email}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      <View>
        <Section title="Account">
          <Row
            icon="person-outline"
            label="Profile Details"
            hint={data.profile.username ? `@${data.profile.username}` : undefined}
            onPress={() => router.push('/(app)/(tabs)/profile')}
          />
          <Row
            icon="lock-closed-outline"
            label="Security & PIN"
            hint={data.security.hasPin ? 'PIN set' : 'Set PIN'}
            onPress={() => router.push('/(app)/settings/security')}
            last
          />
        </Section>
      </View>

      <View>
        <Section title="Preferences">
          <ToggleRow
            icon="notifications-outline"
            label="Email & push notifications"
            hint="Email, push, and in-app alerts for payments & promos"
            value={Boolean(data.preferences.notificationsEnabled)}
            disabled={saving}
            onValueChange={(v) => {
              void (async () => {
                await patch(
                  { notificationsEnabled: v },
                  v ? 'Notifications on' : 'Notifications off',
                );
                try {
                  await user?.reload();
                } catch {
                  // ignore
                }
                setPreferenceEnabled(v);
                if (v) {
                  await registerPushToken();
                } else {
                  await clearPushRegistration();
                  await setAppBadge(0);
                }
              })();
            }}
          />
          <View style={[styles.langBlock, { borderBottomColor: colors.border }]}>
            <View style={styles.langHeader}>
              <IconBubble name="language-outline" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Language</Text>
                <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
                  English
                </Text>
              </View>
              <View style={[styles.langChip, { backgroundColor: Brand.orange }]}>
                <Text style={[styles.langChipText, { color: Brand.white }]}>English</Text>
              </View>
            </View>
          </View>
          <ToggleRow
            icon="moon-outline"
            label="Dark Mode"
            hint="Saved to your account"
            value={darkMode}
            disabled={saving || loading}
            onValueChange={(v) => void patch({ theme: v ? 'dark' : 'light' })}
            last
          />
        </Section>
      </View>

      <View>
        <Section title="Support">
          <Row
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => router.push('/(app)/support')}
          />
          <Row
            icon="chatbubbles-outline"
            label="Live Chat"
            onPress={() => {
              void (async () => {
                const { openLiveChat } = await import('@/lib/support');
                const opened = await openLiveChat();
                if (!opened) router.push('/(app)/support');
              })();
            }}
          />
          <Row
            icon="information-circle-outline"
            label="About ORYNO"
            onPress={() => router.push('/(app)/about')}
            last
          />
        </Section>
      </View>

      <View>
        <Pressable
          style={styles.signOutBtn}
          onPress={() => {
            alert.confirm('Sign out?', 'You can sign back in anytime.', {
              confirmLabel: 'Sign Out',
              destructive: true,
              onConfirm: async () => {
                try {
                  await clearPushRegistration().catch(() => null);
                  await api.post(endpoints.auth.logout).catch(() => null);
                } finally {
                  await signOut();
                  router.replace('/(auth)/login');
                }
              },
            });
          }}>
          <Ionicons name="log-out-outline" size={18} color={Brand.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        {saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={Brand.orange} />
            <Text style={[styles.savingText, { color: colors.mutedForeground }]}>Saving…</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}>
        {children}
      </View>
    </View>
  );
}

function IconBubble({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.iconBubble, { backgroundColor: colors.orangeMuted }]}>
      <Ionicons name={name} size={18} color={Brand.orange} />
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !last && [styles.rowBorder, { borderBottomColor: colors.border }],
        pressed && { backgroundColor: colors.muted },
      ]}
      onPress={onPress}>
      <IconBubble name={icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.rowHint, { color: colors.mutedForeground }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onValueChange,
  disabled,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        !last && [styles.rowBorder, { borderBottomColor: colors.border }],
      ]}>
      <IconBubble name={icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: Brand.orangeSoft }}
        thumbColor={value ? Brand.orange : colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accountHeroWrap: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: Brand.orange,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  accountHero: {
    padding: 12,
    backgroundColor: '#E85D00',
    overflow: 'hidden',
  },
  accountHeroImage: { borderRadius: 0 },
  accountTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  accountEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  accountName: {
    marginTop: 4,
    color: Brand.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  accountEmail: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionWrap: { marginBottom: 12 },
  sectionTitle: {
    marginBottom: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowHint: { marginTop: 2, fontSize: 12, fontWeight: '500' },
  langBlock: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginLeft: 44,
  },
  langChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  langChipText: { fontSize: 12, fontWeight: '700' },
  signOutBtn: {
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)',
    backgroundColor: 'rgba(255,59,48,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: { color: Brand.error, fontSize: 14, fontWeight: '800' },
  savingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savingText: { fontSize: 12, fontWeight: '600' },
  errorCard: {
    marginTop: 12,
    borderRadius: Radius.card,
    padding: 12,
    alignItems: 'center',
  },
  errorTitle: { fontSize: 17, fontWeight: '800' },
  errorSub: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: Brand.orange,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
});
