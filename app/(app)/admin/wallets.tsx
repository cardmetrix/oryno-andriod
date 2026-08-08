import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type WalletRow = {
  id: string;
  user: string;
  email: string;
  currency: string;
  balance: string;
  status: string;
  primary: boolean;
};

export default function AdminWalletsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [q, setQ] = useState('');
  const path = useMemo(() => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return `${endpoints.admin.wallets}${qs}`;
  }, [q]);
  const { data, loading, error, reload } = useAdminQuery<{ wallets: WalletRow[] }>(path);

  return (
    <Screen scroll refreshing={loading} onRefresh={reload}>
      <AdminPageHeader title="Wallets" subtitle="Balances and freeze status" />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search user or email…"
        placeholderTextColor={colors.mutedForeground}
        style={styles.search}
        autoCapitalize="none"
      />
      {loading && !data ? <AdminLoading /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <AdminCard title={`${data.wallets.length} wallets`}>
          {data.wallets.length === 0 ? (
            <AdminEmpty message="No wallets found." />
          ) : (
            data.wallets.map((w) => (
              <View key={w.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {w.user}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {w.email} · {w.currency}
                    {w.primary ? ' · Primary' : ''}
                  </Text>
                  <Text style={styles.balance}>{w.balance}</Text>
                </View>
                <StatusBadge status={w.status} />
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
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    marginBottom: 4,
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
  sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
  balance: { marginTop: 4, fontSize: 14, fontWeight: '800', color: Brand.orange },
});
}

