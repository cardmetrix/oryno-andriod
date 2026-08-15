import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type Response = {
  stats: { codes: number; joins: number; earnings: string };
  referrals: Array<{
    code: string;
    owner: string;
    joins: number;
    earnings: string;
    status: string;
  }>;
};

export default function AdminReferralsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.referrals,
  );

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={<AdminPageHeader title="Referrals" subtitle="Codes and earnings" />}>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Codes" value={String(data.stats.codes)} />
            <StatCard label="Joins" value={String(data.stats.joins)} />
            <StatCard label="Earnings" value={data.stats.earnings} />
          </View>
          <AdminCard title="Referral codes">
            {data.referrals.length === 0 ? (
              <AdminEmpty message="No referral codes." />
            ) : (
              data.referrals.map((r) => (
                <View key={r.code} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.code}</Text>
                    <Text style={styles.sub}>
                      {r.owner} · {r.joins} joins · {r.earnings}
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

