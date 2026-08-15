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

type Gateway = {
  id: string;
  name: string;
  countries: string;
  status: string;
  mode: string;
};

export default function AdminGatewaysScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<{ gateways: Gateway[] }>(
    endpoints.admin.gateways,
  );

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={<AdminPageHeader title="Gateways" subtitle="Payment rails" />}>
      {loading && !data ? <AdminLoading variant="cards" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <AdminCard title="Payment gateways">
          {data.gateways.length === 0 ? (
            <AdminEmpty message="No gateways." />
          ) : (
            data.gateways.map((g) => (
              <View key={g.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{g.name}</Text>
                  <Text style={styles.sub}>
                    {g.countries} · {g.mode}
                  </Text>
                </View>
                <StatusBadge status={g.status} />
              </View>
            ))
          )}
        </AdminCard>
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

