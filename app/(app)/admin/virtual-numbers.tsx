import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { StatCard } from '@/components/admin/stat-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type Response = {
  stock: Array<{ country: string; buy: number; rent: number; status: string }>;
  rented: Array<{ countryCode: string; count: number }>;
  totalRented: number;
};

export default function AdminVirtualNumbersScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.virtualNumbers,
  );

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={<AdminPageHeader title="Virtual Numbers" subtitle="Stock and active rentals" />}>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Total rented" value={String(data.totalRented)} change="All time" />
            <StatCard
              label="Countries active"
              value={String(data.rented.length)}
              change="With rentals"
            />
          </View>
          <AdminCard title="Stock by country">
            {data.stock.length === 0 ? (
              <AdminEmpty message="No stock rows." />
            ) : (
              data.stock.map((s) => (
                <View key={s.country} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{s.country}</Text>
                    <Text style={styles.sub}>
                      Buy {s.buy} · Rent {s.rent}
                    </Text>
                  </View>
                  <StatusBadge status={s.status} />
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
  sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
});
}

