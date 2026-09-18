import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type Response = {
  demo?: boolean;
  revenue?: {
    volume30d: number;
    completed30d: number;
    profit30d: number;
    revenueEntries30d: number;
    charge: {
      mode: 'flat' | 'percent';
      value: number;
      enabled: boolean;
    };
  };
  providers: Array<{
    id: string;
    name: string;
    status: string;
    minAmount: number;
    maxAmount: number;
  }>;
  recent: Array<{
    id: string;
    provider: string;
    customerRef: string;
    customerName: string;
    amount: string;
    status: string;
    reference: string;
    when: string;
  }>;
};

function money(n: number) {
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminBettingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.betting,
  );

  const revenue = data?.revenue;
  const chargeLabel = revenue?.charge
    ? !revenue.charge.enabled
      ? 'Off'
      : revenue.charge.mode === 'percent'
        ? `${revenue.charge.value}%`
        : money(revenue.charge.value)
    : '—';

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Betting Funding"
          subtitle={
            data?.demo
              ? 'Demo mode — catalog + recent wallet funding tests'
              : 'Bookmakers, funding volume, and company profit'
          }
        />
      }>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data && revenue ? (
        <View style={styles.stats}>
          <StatCard
            label="Volume (30d)"
            value={money(revenue.volume30d)}
            change={`${revenue.completed30d} completed funds`}
          />
          <StatCard
            label="Company profit (30d)"
            value={money(revenue.profit30d)}
            change={`${revenue.revenueEntries30d} revenue entries`}
            up={revenue.profit30d > 0}
          />
          <StatCard
            label="Betting charge"
            value={chargeLabel}
            change="Edit under Revenue"
          />
          <StatCard
            label="Live mode"
            value={data.demo ? 'Demo' : 'Live'}
            change="Tune fee in Revenue"
          />
        </View>
      ) : null}

      {data ? (
        <>
          <AdminCard title="Bookmakers">
            {data.providers.length === 0 ? (
              <AdminEmpty message="No betting providers configured." />
            ) : (
              data.providers.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{row.name}</Text>
                    <Text style={styles.sub}>
                      {row.id} · min ₦{row.minAmount} · max ₦{row.maxAmount}
                    </Text>
                  </View>
                  <StatusBadge status={row.status} />
                </View>
              ))
            )}
          </AdminCard>

          <AdminCard title="Recent funding">
            {data.recent.length === 0 ? (
              <AdminEmpty message="No betting funding yet." />
            ) : (
              data.recent.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>
                      {row.provider} · ₦{row.amount}
                    </Text>
                    <Text style={styles.sub}>
                      {row.customerName} · {row.customerRef}
                    </Text>
                    <Text style={styles.meta}>
                      {row.when} · {row.reference}
                    </Text>
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
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
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
    meta: { marginTop: 4, fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  });
}
