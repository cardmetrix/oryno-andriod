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
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
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
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<SettingsPayload>(endpoints.settings.root);
      setSecurity(json.security);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load security settings');
    } finally {
      setLoading(false);
    }
  }, []);

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
      alert.success('Saved', 'Transaction PIN updated.');
    }
  }

  if (loading && !security) {
    return (
      <Screen>
        <PageHeader
          title="Security Settings"
          subtitle="2FA, biometrics, and transaction PIN"
          showBack
        />
        <SecuritySkeleton />
      </Screen>
    );
  }

  if (error && !security) {
    return (
      <Screen>
        <PageHeader title="Security Settings" showBack />
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
    <Screen scroll refreshing={loading} onRefresh={load}>
      <PageHeader
        title="Security Settings"
        subtitle="2FA, biometrics, and transaction PIN"
        showBack
      />

      <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
        <SecurityRow
          icon="shield-checkmark-outline"
          title="Two-Factor Auth (2FA)"
          subtitle="Extra login protection"
          value={security.twoFactorEnabled}
          disabled={saving}
          onValueChange={(v) => void patch({ twoFactorEnabled: v })}
        />
        <SecurityRow
          icon="finger-print-outline"
          title="Biometric Sign In"
          subtitle="Face ID / fingerprint on device"
          value={security.biometricEnabled}
          disabled={saving}
          onValueChange={(v) => void patch({ biometricEnabled: v })}
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
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
      gap: 12,
    },
    securityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    pinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 14,
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
      marginTop: 16,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 20,
      gap: 14,
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
      marginTop: 24,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 24,
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
      marginTop: 16,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 16,
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
