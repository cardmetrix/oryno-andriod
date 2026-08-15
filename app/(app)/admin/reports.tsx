import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatCard } from '@/components/admin/stat-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type Response = {
  summary: { volume30d: string; transactions30d: number };
  categories: Array<{ category: string; total: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
};

export default function AdminReportsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.reports,
  );

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={<AdminPageHeader title="Reports" subtitle="Last 30 days" />}>
      {loading && !data ? <AdminLoading variant="reports" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Volume (30d)" value={data.summary.volume30d} change="NGN" />
            <StatCard
              label="Transactions"
              value={String(data.summary.transactions30d)}
              change="30 days"
            />
          </View>
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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

