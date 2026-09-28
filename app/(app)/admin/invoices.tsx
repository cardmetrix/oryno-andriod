import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type InvoicesResponse = {
  settings: { enabled: boolean; paymentLinksEnabled: boolean };
  invoices: Array<{
    id: string;
    customer: string;
    amount: string;
    status: string;
    createdAt?: string;
  }>;
};

export default function AdminInvoicesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<InvoicesResponse>(
    endpoints.admin.invoices,
  );
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [paymentLinksEnabled, setPaymentLinksEnabled] = useState<boolean | null>(null);

  const settingsEnabled = enabled ?? data?.settings.enabled ?? true;
  const settingsPay = paymentLinksEnabled ?? data?.settings.paymentLinksEnabled ?? true;

  async function saveSettings(next: {
    enabled: boolean;
    paymentLinksEnabled: boolean;
  }) {
    setBusy(true);
    try {
      await adminApi.patch(endpoints.admin.invoices, next);
      setEnabled(next.enabled);
      setPaymentLinksEnabled(next.paymentLinksEnabled);
      toast.success('Invoice settings updated');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Invoices"
          subtitle="Invoice generator · payment links · PDF downloads"
        />
      }>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Invoices loaded" value={String(data.invoices.length)} />
            <StatCard label="Generator" value={settingsEnabled ? 'On' : 'Off'} />
            <StatCard label="Payment links" value={settingsPay ? 'On' : 'Off'} />
          </View>

          <AdminCard title="Settings">
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Invoice generator enabled</Text>
              <Switch
                value={settingsEnabled}
                disabled={busy}
                onValueChange={(value) =>
                  void saveSettings({ enabled: value, paymentLinksEnabled: settingsPay })
                }
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Payment links enabled</Text>
              <Switch
                value={settingsPay}
                disabled={busy}
                onValueChange={(value) =>
                  void saveSettings({ enabled: settingsEnabled, paymentLinksEnabled: value })
                }
              />
            </View>
          </AdminCard>

          <AdminCard title="Recent invoices">
            {data.invoices.length === 0 ? (
              <AdminEmpty message="No invoices yet." />
            ) : (
              data.invoices.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{row.id}</Text>
                    <Text style={styles.sub}>{row.customer}</Text>
                    <Text style={styles.meta}>{row.amount}</Text>
                  </View>
                  <StatusBadge status={row.status} />
                </View>
              ))
            )}
          </AdminCard>
        </>
      ) : null}
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    settingLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.foreground },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
    meta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: colors.foreground },
  });
}
