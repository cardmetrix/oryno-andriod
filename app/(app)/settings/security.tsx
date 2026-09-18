import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { TotpDisableModal, TotpSetupModal } from '@/components/settings/totp-setup-modal';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppLock } from '@/context/app-lock-context';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

type SecurityState = {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  hasPin: boolean;
};

type SettingsPayload = {
  security: SecurityState;
  message?: string;
  error?: string;
};

export default function SecurityScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { refreshMeta, setEnabled: setBiometricEnabled, enabled: biometricOn, meta } =
    useAppLock();
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [showDisableTotp, setShowDisableTotp] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const totpOn = Boolean(security?.twoFactorEnabled);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<SettingsPayload>(endpoints.settings.root);
      setSecurity(json.security);
      await refreshMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load security settings');
    } finally {
      setLoading(false);
    }
  }, [refreshMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const json = await api.patch<SettingsPayload>(endpoints.settings.root, body);
      setSecurity(json.security);
      return true;
    } catch (e) {
      alert.error('Update failed', e instanceof Error ? e.message : 'Update failed');
      await load();
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function savePin() {
    if (!/^\d{4,6}$/.test(pin)) {
      alert.warning('Invalid PIN', 'PIN must be 4–6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      alert.warning('Mismatch', 'PINs do not match.');
      return;
    }
    if (security?.hasPin && !currentPin) {
      alert.warning('Current PIN required', 'Enter your current PIN to change it.');
      return;
    }
    const ok = await patch({
      pin,
      currentPin: security?.hasPin ? currentPin : undefined,
    });
    if (ok) {
      setShowPinForm(false);
      setCurrentPin('');
      setPin('');
      setConfirmPin('');
      alert.success(
        security?.hasPin ? 'PIN changed' : 'PIN created',
        security?.hasPin
          ? 'Your transaction PIN was updated. You’ll get an email and push alert.'
          : 'Your transaction PIN is ready. You’ll get an email and push alert.',
      );
    }
  }

  function onToggle2fa(next: boolean) {
    if (next) {
      setShowTotp(true);
      return;
    }
    setShowDisableTotp(true);
  }

  async function onToggleBiometric(next: boolean) {
    setSaving(true);
    const result = await setBiometricEnabled(next);
    setSaving(false);
    if (!result.ok) {
      alert.warning(meta.title, result.error || 'Could not update biometric unlock.');
      return;
    }
    setSecurity((prev) => (prev ? { ...prev, biometricEnabled: next } : prev));
  }

  if (loading && !security) {
    return (
      <Screen
        header={
          <PageHeader
            title="Security Settings"
            subtitle="2FA, biometrics, and transaction PIN"
            showBack
          />
        }>
        <SecuritySkeleton />
      </Screen>
    );
  }

  if (error && !security) {
    return (
      <Screen
        header={<PageHeader title="Security Settings" showBack />}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Couldn’t load security</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!security) return null;

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={load}
      header={
        <PageHeader
          title="Security Settings"
          subtitle="2FA, biometrics, and transaction PIN"
          showBack
        />
      }>
      <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
        <SecurityRow
          icon="shield-checkmark-outline"
          title="Google Authenticator"
          subtitle={totpOn ? 'Required at every sign-in' : 'Add an authenticator app for 2FA'}
          value={totpOn}
          disabled={saving}
          onValueChange={onToggle2fa}
        />
        <SecurityRow
          icon="finger-print"
          title={meta.title}
          subtitle={
            meta.available
              ? meta.subtitle
              : meta.hasHardware
                ? `Set up ${meta.title} in device settings first`
                : 'Not available on this device'
          }
          value={biometricOn}
          disabled={saving || !meta.available}
          onValueChange={(v) => void onToggleBiometric(v)}
        />

        <View style={styles.pinRow}>
          <View style={styles.pinLeft}>
            <View style={styles.iconBubble}>
              <Ionicons name="key-outline" size={18} color={Brand.orange} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>Transaction PIN</Text>
              <Text style={styles.rowSubtitle}>
                {security.hasPin ? 'PIN is active' : 'Not set yet'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setShowPinForm((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Text style={styles.pinAction}>
              {security.hasPin ? 'Change' : 'Set PIN'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {showPinForm ? (
        <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.pinForm}>
          <Text style={styles.pinFormTitle}>
            {security.hasPin ? 'Change transaction PIN' : 'Create transaction PIN'}
          </Text>
          {security.hasPin ? (
            <TextField
              label="Current PIN"
              value={currentPin}
              onChangeText={(t) => setCurrentPin(t.replace(/\D/g, ''))}
              secureTextEntry
              keyboardType="number-pad"
              placeholder="••••"
              maxLength={6}
            />
          ) : null}
          <TextField
            label="New PIN (4–6 digits)"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="••••"
            maxLength={6}
          />
          <TextField
            label="Confirm PIN"
            value={confirmPin}
            onChangeText={(t) => setConfirmPin(t.replace(/\D/g, ''))}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="••••"
            maxLength={6}
          />
          <View style={styles.pinActions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setShowPinForm(false);
                setCurrentPin('');
                setPin('');
                setConfirmPin('');
              }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (saving || pin.length < 4) && styles.saveBtnDisabled,
                pressed && !(saving || pin.length < 4) && { opacity: 0.9 },
              ]}
              disabled={saving || pin.length < 4}
              onPress={() => void savePin()}>
              {saving ? (
                <ActivityIndicator size="small" color={Brand.white} />
              ) : null}
              <Text style={styles.saveText}>Save PIN</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <TotpSetupModal
        visible={showTotp}
        onClose={() => setShowTotp(false)}
        onEnabled={() => {
          setSecurity((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));
        }}
      />
      <TotpDisableModal
        visible={showDisableTotp}
        onClose={() => setShowDisableTotp(false)}
        onDisabled={() => {
          setSecurity((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));
        }}
      />
    </Screen>
  );
}

function SecurityRow({
  icon,
  title,
  subtitle,
  value,
  disabled,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.securityRow}>
      <View style={styles.pinLeft}>
        <View style={styles.iconBubble}>
          <Ionicons name={icon} size={18} color={Brand.orange} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: Brand.orangeSoft }}
        thumbColor={value ? Brand.orange : Brand.white}
      />
    </View>
  );
}

function SecuritySkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={[styles.securityRow, { opacity: 0.55 }]}>
          <View style={styles.pinLeft}>
            <View style={[styles.iconBubble, { backgroundColor: colors.muted }]} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.skelLineLg} />
              <View style={styles.skelLineSm} />
            </View>
          </View>
          <View style={styles.skelSwitch} />
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 28,
      backgroundColor: colors.card,
      padding: 12,
      gap: 12,
    },
    securityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pinLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowSubtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    pinAction: { fontSize: 12, fontWeight: '800', color: Brand.orange },
    pinForm: {
      marginTop: 12,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      gap: 10,
    },
    pinFormTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    pinActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    saveBtn: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveText: { fontSize: 14, fontWeight: '800', color: Brand.white },
    errorCard: {
      marginTop: 12,
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      padding: 12,
      alignItems: 'center',
    },
    errorTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    errorSub: {
      marginTop: 6,
      fontSize: 13,
      color: colors.mutedForeground,
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
    skelLineLg: {
      height: 14,
      width: '55%',
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    skelLineSm: {
      height: 11,
      width: '70%',
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    skelSwitch: {
      width: 44,
      height: 26,
      borderRadius: 99,
      backgroundColor: colors.border,
    },
  });
}
