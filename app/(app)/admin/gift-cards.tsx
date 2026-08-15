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

type GiftCardsResponse = {
  rates: Array<{ brand: string; buy: string; sell: string; status: string }>;
  orders: Array<{
    id: string;
    user: string;
    brand: string;
    type: string;
    amount: string;
    status: string;
  }>;
};

export default function AdminGiftCardsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<GiftCardsResponse>(
    endpoints.admin.giftCards,
  );

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={<AdminPageHeader title="Gift Cards" subtitle="Rates and recent orders" />}>
      {loading && !data ? <AdminLoading /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <AdminCard title="Rates">
            {data.rates.length === 0 ? (
              <AdminEmpty message="No rates." />
            ) : (
              data.rates.map((r) => (
                <View key={r.brand} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.brand}</Text>
                    <Text style={styles.sub}>
                      Buy {r.buy} · Sell {r.sell}
                    </Text>
                  </View>
                  <StatusBadge status={r.status} />
                </View>
              ))
            )}
          </AdminCard>
          <AdminCard title="Recent orders">
            {data.orders.length === 0 ? (
              <AdminEmpty message="No orders." />
            ) : (
              data.orders.map((o) => (
                <View key={o.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {o.id}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {o.user} · {o.brand} · {o.type} · {o.amount}
                    </Text>
                  </View>
                  <StatusBadge status={o.status} />
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

