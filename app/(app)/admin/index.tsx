import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { endpoints } from '@/lib/endpoints';

type OverviewResponse = {
  stats: Array<{ label: string; value: string; change: string; up: boolean }>;
  giftCardOrders: Array<{
    id: string;
    user: string;
    brand: string;
    type: string;
    status: string;
  }>;
  activity: Array<{ id: string; title: string; type: string; time: string }>;
  countries: Array<{
    code: string;
    name: string;
    currency: string;
    gateway: string;
    services: string;
    status: string;
  }>;
};

export default function AdminOverviewScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<OverviewResponse>(
    endpoints.admin.overview,
  );

  return (
    <Screen scroll refreshing={loading} onRefresh={reload}>
      <AdminPageHeader
        title="Overview"
        subtitle="Live pulse across users, wallets, and country configs"
        actions={
          <>
            <Pressable
              style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.9 }]}
              onPress={() => router.push('/(app)/admin/countries' as never)}>
              <Text style={styles.btnSecondaryText}>Countries</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.92 }]}
              onPress={() => router.push('/(app)/admin/reports' as never)}>
              <Text style={styles.btnPrimaryText}>Reports</Text>
              <Ionicons name="arrow-up" size={14} color={Brand.white} />
            </Pressable>
          </>
        }
      />

      {loading && !data ? <AdminLoading variant="overview" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            {data.stats.map((stat, index) => (
              <Animated.View
                key={stat.label}
                entering={FadeInDown.delay(index * 50).duration(280)}
                style={styles.statWrap}>
                <StatCard {...stat} />
              </Animated.View>
            ))}
          </View>

          <AdminCard title="Recent gift card orders">
            {data.giftCardOrders.length === 0 ? (
              <AdminEmpty message="No gift card orders yet." />
            ) : (
              data.giftCardOrders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {order.id}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {order.user}
                      </Text>
                    </View>
                    <StatusBadge status={order.status} />
                  </View>
                  <Text style={styles.orderMeta}>
                    {order.brand} · {order.type}
                  </Text>
                </View>
              ))
            )}
          </AdminCard>

          <AdminCard title="Activity">
            {data.activity.length === 0 ? (
              <AdminEmpty message="No recent transactions." />
            ) : (
              data.activity.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInRight.delay(80 + index * 40).duration(260)}
                  style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="pulse" size={16} color={Brand.orange} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowSub}>
                      {item.type} · {item.time}
                    </Text>
                  </View>
                </Animated.View>
              ))
            )}
          </AdminCard>

          <AdminCard title="Country configuration">
            {data.countries.length === 0 ? (
              <AdminEmpty message="No countries configured." />
            ) : (
              <View style={styles.countryGrid}>
                {data.countries.map((country) => (
                  <View key={country.code} style={styles.countryCard}>
                    <View style={styles.countryTop}>
                      <Text style={styles.countryName} numberOfLines={1}>
                        {country.name}
                      </Text>
                      <StatusBadge status={country.status} />
                    </View>
                    <Text style={styles.rowSub}>
                      {country.currency} · {country.gateway}
                    </Text>
                    <Text style={styles.countryServices} numberOfLines={2}>
                      {country.services}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </AdminCard>
        </>
      ) : null}
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  btnSecondary: {
    height: 42,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  btnPrimary: {
    height: 42,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: Brand.orange,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: Brand.white },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statWrap: { width: '48%', flexGrow: 1 },
  orderCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 12,
  },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  orderMeta: { marginTop: 8, fontSize: 12, fontWeight: '600', color: colors.foreground },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  countryCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 10,
    gap: 6,
  },
  countryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  countryName: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.foreground },
  countryServices: { fontSize: 11, color: colors.mutedForeground, lineHeight: 15 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  rowSub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
});
}

