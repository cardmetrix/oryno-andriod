import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { Screen } from '@/components/ui/screen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';
import { USD_CARD_ISSUER } from '@/lib/support-config';

type Entry = {
  id: string;
  email: string;
  name: string;
  countryCode: string | null;
  provider: string;
  joinedAt: string;
};

export default function AdminWaitlistScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<{
    count: number;
    entries: Entry[];
  }>(endpoints.admin.waitlistUsdCard);

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="USD virtual card waitlist"
          subtitle={`Users waiting for ${USD_CARD_ISSUER}-issued USD cards`}
        />
      }>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Joined" value={String(data.count)} />
            <StatCard label="Issuer" value={USD_CARD_ISSUER} />
          </View>
          <AdminCard title="Waitlist">
            {data.entries.length === 0 ? (
              <AdminEmpty message="No waitlist signups yet." />
            ) : (
              data.entries.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{row.name}</Text>
                    <Text style={styles.sub}>{row.email}</Text>
                    <Text style={styles.meta}>
                      {row.countryCode || '—'} · {row.provider} ·{' '}
                      {new Date(row.joinedAt).toLocaleString()}
                    </Text>
                  </View>
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
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
    meta: { marginTop: 4, fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  });
}
