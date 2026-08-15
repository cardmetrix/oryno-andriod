import { useEffect, useState, type ReactNode, useMemo } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminError, AdminLoading } from '@/components/admin/admin-state';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type Settings = {
  compactTables: boolean;
  realtimeActivity: boolean;
  requireAdmin2fa: boolean;
  freezeHighRiskWallets: boolean;
  auditLogging: boolean;
  payoutSla: string;
  supportEmail: string;
  defaultCurrencyDisplay: string;
  giftCardsModule: string;
};

export default function AdminSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<{ settings: Settings }>(
    endpoints.admin.settings,
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) setSettings(data.settings);
  }, [data]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await adminApi.patch<{ settings: Settings }>(
        endpoints.admin.settings,
        settings,
      );
      setSettings(res.settings);
      toast.success('Settings saved');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
      refreshing={loading || saving}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Admin Settings"
          subtitle="Console preferences, security, and operational defaults"
        />
      }>
      {loading && !settings ? <AdminLoading variant="settings" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {settings ? (
        <>
          <AdminCard title="Console preferences">
            <PrefRow
              label="Compact tables"
              description="Show denser rows on large screens"
              control={
                <Switch
                  value={settings.compactTables}
                  onValueChange={(v) => setSettings({ ...settings, compactTables: v })}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              }
            />
            <PrefRow
              label="Realtime activity"
              description="Stream admin activity feed"
              control={
                <Switch
                  value={settings.realtimeActivity}
                  onValueChange={(v) => setSettings({ ...settings, realtimeActivity: v })}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              }
            />
          </AdminCard>

          <AdminCard title="Security defaults">
            <PrefRow
              label="Require 2FA for admins"
              description="OTP challenge on sensitive actions"
              control={
                <Switch
                  value={settings.requireAdmin2fa}
                  onValueChange={(v) => setSettings({ ...settings, requireAdmin2fa: v })}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              }
            />
            <PrefRow
              label="Freeze high-risk wallets"
              description="Auto-hold suspicious payout patterns"
              control={
                <Switch
                  value={settings.freezeHighRiskWallets}
                  onValueChange={(v) =>
                    setSettings({ ...settings, freezeHighRiskWallets: v })
                  }
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              }
            />
            <PrefRow
              label="Audit logging"
              description="Keep immutable admin action logs"
              control={
                <Switch
                  value={settings.auditLogging}
                  onValueChange={(v) => setSettings({ ...settings, auditLogging: v })}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              }
            />
          </AdminCard>

          <AdminCard title="Operational defaults">
            <View style={styles.fields}>
              <Field
                label="Default payout SLA"
                value={settings.payoutSla}
                onChange={(v) => setSettings({ ...settings, payoutSla: v })}
              />
              <Field
                label="Support email"
                value={settings.supportEmail}
                onChange={(v) => setSettings({ ...settings, supportEmail: v })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Default currency display"
                value={settings.defaultCurrencyDisplay}
                onChange={(v) => setSettings({ ...settings, defaultCurrencyDisplay: v })}
              />
              <Field
                label="Gift cards module"
                value={settings.giftCardsModule}
                onChange={(v) => setSettings({ ...settings, giftCardsModule: v })}
              />
            </View>

            <Button
              title={saving ? 'Saving…' : 'Save changes'}
              loading={saving}
              disabled={saving}
              onPress={() => void save()}
              style={{ marginTop: 12 }}
            />
          </AdminCard>
        </>
      ) : null}
    </Screen>
  );
}

function PrefRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.prefRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefDesc}>{description}</Text>
      </View>
      {control}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.fieldInput}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: colors.card,
  },
  prefLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  prefDesc: { marginTop: 2, fontSize: 12, color: colors.mutedForeground, lineHeight: 16 },
  fields: { gap: 10 },
  field: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    paddingVertical: 2,
  },
});
}

