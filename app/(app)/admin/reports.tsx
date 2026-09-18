import * as Clipboard from 'expo-clipboard';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type Response = {
  summary: { volume30d: string; transactions30d: number };
  series: Array<{ day: string; total: number; count: number }>;
  categories: Array<{ category: string; total: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
};

export default function AdminReportsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.reports,
  );

  const series = data?.series?.slice(-14) || [];
  const max = Math.max(1, ...series.map((s) => s.total));

  const completed =
    data?.statuses.find((s) => s.status === 'Completed')?.count || 0;
  const totalStatus =
    data?.statuses.reduce((s, row) => s + row.count, 0) || 0;
  const successRate =
    totalStatus > 0 ? ((completed / totalStatus) * 100).toFixed(1) : '—';

  async function exportCsv() {
    if (!data?.series?.length) return;
    const lines = [
      'day,total,count',
      ...data.series.map((s) => `${s.day},${s.total},${s.count}`),
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    toast.success('CSV copied', {
      description: 'Paste into a spreadsheet or notes app',
    });
  }

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Reports & Analytics"
          subtitle="Volume and category performance from the ledger (30 days)"
        />
      }>
      {loading && !data ? <AdminLoading variant="reports" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <Pressable
            onPress={() => void exportCsv()}
            disabled={!data.series?.length}
            style={({ pressed }) => [
              styles.exportBtn,
              (!data.series?.length || pressed) && { opacity: 0.7 },
            ]}>
            <Text style={styles.exportText}>Export CSV</Text>
          </Pressable>

          <View style={styles.stats}>
            <StatCard
              label="Gross volume"
              value={data.summary.volume30d}
              change="Last 30 days"
              up
            />
            <StatCard
              label="Transactions"
              value={String(data.summary.transactions30d)}
              change="Last 30 days"
              up
            />
            <StatCard
              label="Completed rate"
              value={successRate === '—' ? '—' : `${successRate}%`}
              change="By status"
              up
            />
            <StatCard
              label="Categories"
              value={String(data.categories.length)}
              change="Active buckets"
              up
            />
          </View>

          <AdminCard title="Daily transaction volume">
            {series.length === 0 ? (
              <AdminEmpty message="No transactions in the last 30 days." />
            ) : (
              <View style={styles.chart}>
                {series.map((item) => {
                  const height = Math.max(6, (item.total / max) * 140);
                  return (
                    <View key={item.day} style={styles.barCol}>
                      <View style={[styles.bar, { height }]} />
                      <Text style={styles.barLabel}>{item.day.slice(8)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </AdminCard>

          <AdminCard title="By category">
            {data.categories.length === 0 ? (
              <AdminEmpty message="No category data." />
            ) : (
              data.categories.map((c) => (
                <View key={c.category} style={styles.row}>
                  <Text style={[styles.title, { flex: 1 }]}>{c.category}</Text>
                  <Text style={styles.meta}>
                    {c.total} · {c.count}
                  </Text>
                </View>
              ))
            )}
          </AdminCard>

          <AdminCard title="By status">
            {data.statuses.length === 0 ? (
              <AdminEmpty message="No status data." />
            ) : (
              data.statuses.map((s) => (
                <View key={s.status} style={styles.row}>
                  <Text style={[styles.title, { flex: 1 }]}>{s.status}</Text>
                  <Text style={styles.meta}>{s.count}</Text>
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
    exportBtn: {
      alignSelf: 'flex-start',
      marginBottom: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    exportText: { fontSize: 13, fontWeight: '700', color: Brand.orange },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      minHeight: 168,
      paddingTop: 8,
    },
    barCol: { flex: 1, alignItems: 'center', gap: 6 },
    bar: {
      width: '100%',
      maxWidth: 28,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      backgroundColor: Brand.orange,
      minHeight: 6,
    },
    barLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    meta: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  });
}
