import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type Response = {
  providers: Array<{
    id: string;
    name: string;
    category: string;
    country: string;
    status: string;
  }>;
  recent: Array<{
    id: string;
    provider: string;
    customerRef: string;
    amount: string;
    status: string;
    when: string;
  }>;
};

export default function AdminBillsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(endpoints.admin.bills);

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={<AdminPageHeader title="Bill Providers" subtitle="Catalog and recent payments" />}>
      {loading && !data ? <AdminLoading /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <AdminCard title="Providers">
            {data.providers.length === 0 ? (
              <AdminEmpty message="No providers." />
            ) : (
              data.providers.map((p) => (
                <View key={p.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{p.name}</Text>
                    <Text style={styles.sub}>
                      {p.category} · {p.country}
                    </Text>
                  </View>
                  <StatusBadge status={p.status} />
                </View>
              ))
            )}
          </AdminCard>
          <AdminCard title="Recent payments">
            {data.recent.length === 0 ? (
              <AdminEmpty message="No recent bill payments." />
            ) : (
              data.recent.map((r) => (
                <View key={r.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{r.provider}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {r.customerRef} · {r.amount} · {r.when}
                    </Text>
                  </View>
                  <StatusBadge status={r.status} />
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

