import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { PickerOptionList, PickerSheet } from '@/components/app/picker-sheet';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useProfile } from '@/hooks/use-profile';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useTransactions } from '@/hooks/use-transactions';
import { getCountryInfo } from '@/lib/country';
import {
  buildCategoryBreakdown,
  buildDailySeries,
  buildHistoryMonths,
  filterHistoryItems,
  formatMoneyAmount,
  summarizeCashflow,
} from '@/lib/history';

type StatTone = 'credit' | 'debit';

type StatCard = {
  label: string;
  value: string;
  tone: StatTone;
  renderIcon: (color: string) => ReactNode;
};

export default function HistoryAnalyticsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ month?: string }>();
  const { items, loading, refresh } = useTransactions();
  const { countryCode } = useProfile();
  const { pulling, onRefresh } = usePullRefresh(refresh);

  const months = useMemo(() => buildHistoryMonths(items), [items]);
  const [monthKey, setMonthKey] = useState(
    typeof params.month === 'string' ? params.month : '',
  );
  const [monthSheet, setMonthSheet] = useState(false);

  useEffect(() => {
    if (!months.length) return;
    if (!monthKey || !months.some((m) => m.key === monthKey)) {
      const fromParam =
        typeof params.month === 'string' &&
        months.some((m) => m.key === params.month)
          ? params.month
          : months[0].key;
      setMonthKey(fromParam);
    }
  }, [months, monthKey, params.month]);

  const activeMonth = months.find((m) => m.key === monthKey) ?? months[0];
  const currency = useMemo(() => {
    const fromItems = items.find((item) => item.currency)?.currency;
    return (fromItems || getCountryInfo(countryCode).currency || 'NGN').toUpperCase();
  }, [items, countryCode]);

  const monthItems = useMemo(
    () => filterHistoryItems(items, { monthKey: activeMonth?.key }),
    [items, activeMonth?.key],
  );
  const totals = useMemo(() => summarizeCashflow(monthItems), [monthItems]);
  const categories = useMemo(() => buildCategoryBreakdown(monthItems), [monthItems]);
  const series = useMemo(
    () => (activeMonth ? buildDailySeries(monthItems, activeMonth.key) : []),
    [monthItems, activeMonth],
  );

  const maxBar = Math.max(1, ...series.map((p) => Math.max(p.inflow, p.outflow)));
  const maxCategory = Math.max(1, ...categories.map((c) => c.total));
  const spendShare =
    totals.inflow + totals.outflow > 0
      ? totals.outflow / (totals.inflow + totals.outflow)
      : 0;

  const stats: StatCard[] = [
    {
      label: 'In',
      value: formatMoneyAmount(totals.inflow, currency),
      tone: 'credit',
      // Matches website Lucide ArrowDownLeft
      renderIcon: (color) => <Feather name="arrow-down-left" size={14} color={color} />,
    },
    {
      label: 'Out',
      value: formatMoneyAmount(totals.outflow, currency),
      tone: 'debit',
      // Matches website Lucide ArrowUpRight
      renderIcon: (color) => <Feather name="arrow-up-right" size={14} color={color} />,
    },
    {
      label: 'Net',
      value: formatMoneyAmount(totals.net, currency, {
        signed: true,
        type: totals.net >= 0 ? 'credit' : 'debit',
      }),
      tone: totals.net >= 0 ? 'credit' : 'debit',
      // Matches website Lucide Scale (balance)
      renderIcon: (color) => (
        <MaterialCommunityIcons name="scale-balance" size={14} color={color} />
      ),
    },
  ];

  return (
    <Screen
      scroll
      refreshing={pulling}
      onRefresh={onRefresh}
      header={
        <PageHeader
          title="Analysis"
          subtitle={activeMonth?.longLabel ?? 'Spending insights'}
          showBack
          right={
            <Pressable style={styles.monthChip} onPress={() => setMonthSheet(true)}>
              <Text style={styles.monthChipText}>{activeMonth?.label ?? '—'}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </Pressable>
          }
        />
      }>
      {loading && !items.length ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <View style={styles.statsRow}>
            {stats.map((stat, i) => (
              <Animated.View
                key={stat.label}
                entering={FadeInDown.delay(40 + i * 50).duration(320)}
                style={[
                  styles.statCard,
                  stat.label === 'In' ? styles.statCardIn : styles.statCardDefault,
                ]}>
                <View style={styles.statLabelRow}>
                  {stat.renderIcon(
                    stat.tone === 'credit' ? Brand.success : colors.mutedForeground,
                  )}
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                <Text
                  style={[
                    styles.statValue,
                    stat.tone === 'credit' && { color: Brand.success },
                  ]}
                  numberOfLines={1}>
                  {stat.value}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View
            entering={FadeInDown.delay(80).duration(320)}
            style={styles.panel}>
            <View style={styles.panelHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.panelTitle}>Daily cashflow</Text>
                <Text style={styles.panelSub}>In vs out for {activeMonth?.label}</Text>
              </View>
              <View style={styles.spendBadge}>
                <Text style={styles.spendBadgeText}>
                  {Math.round(spendShare * 100)}% spent
                </Text>
              </View>
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Brand.success }]} />
                <Text style={styles.legendText}>In</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Brand.orange }]} />
                <Text style={styles.legendText}>Out</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScroll}>
              {series.length === 0 ? (
                <Text style={[styles.muted, { alignSelf: 'center' }]}>
                  No daily activity yet.
                </Text>
              ) : (
                series.map((point, index) => {
                  const inH = Math.max(4, (point.inflow / maxBar) * 140);
                  const outH = Math.max(4, (point.outflow / maxBar) * 140);
                  return (
                    <Animated.View
                      key={point.key}
                      entering={FadeIn.delay(Math.min(index * 12, 350)).duration(400)}
                      style={styles.barCol}>
                      <View style={styles.barPair}>
                        <View
                          style={[
                            styles.barIn,
                            { height: point.inflow > 0 ? inH : 4 },
                          ]}
                        />
                        <View
                          style={[
                            styles.barOut,
                            { height: point.outflow > 0 ? outH : 4 },
                          ]}
                        />
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(120).duration(320)}
            style={styles.panel}>
            <Text style={styles.panelTitle}>By category</Text>
            <Text style={styles.panelSub}>Where money moved this month</Text>

            <View style={styles.catList}>
              {categories.length === 0 ? (
                <Text style={styles.muted}>No activity in this period.</Text>
              ) : (
                categories.map((cat, index) => (
                  <Animated.View
                    key={cat.id}
                    entering={FadeInDown.delay(50 + index * 40).duration(280)}
                    style={styles.catBlock}>
                    <View style={styles.catRow}>
                      <Text style={styles.catLabel} numberOfLines={1}>
                        {cat.label}
                      </Text>
                      <Text style={styles.catValue}>
                        {formatMoneyAmount(cat.total, currency)} · {cat.count}
                      </Text>
                    </View>
                    <View style={styles.catTrack}>
                      <LinearGradient
                        colors={[Brand.orange, '#FF8A33']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.catFill,
                          {
                            width: `${Math.max(
                              6,
                              Math.round((cat.total / maxCategory) * 100),
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </Animated.View>
                ))
              )}
            </View>
          </Animated.View>
        </>
      )}

      <PickerSheet
        visible={monthSheet}
        title="Month"
        subtitle="Choose a statement period"
        onClose={() => setMonthSheet(false)}>
        <PickerOptionList
          value={activeMonth?.key ?? ''}
          onChange={(id) => {
            setMonthKey(id);
            setMonthSheet(false);
          }}
          options={months.map((m) => ({
            id: m.key,
            title: m.longLabel,
            trailing: m.label,
          }))}
        />
      </PickerSheet>
    </Screen>
  );
}

function AnalyticsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.statsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.statCard, styles.statCardDefault, { flex: 1 }]}>
            <Skeleton width={40} height={10} radius={6} />
            <Skeleton width="80%" height={16} radius={8} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Skeleton width={120} height={16} radius={8} />
        <Skeleton width={160} height={12} radius={6} style={{ marginTop: 8 }} />
        <Skeleton width="100%" height={140} radius={16} style={{ marginTop: 16 }} />
      </View>
      <View style={styles.panel}>
        <Skeleton width={100} height={16} radius={8} />
        <Skeleton width={180} height={12} radius={6} style={{ marginTop: 8 }} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ marginTop: 16 }}>
            <Skeleton width="60%" height={12} radius={6} />
            <Skeleton width="100%" height={10} radius={999} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    monthChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    monthChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      borderRadius: 22,
      borderWidth: 1,
      padding: 12,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
      minWidth: 0,
    },
    statCardIn: {
      borderColor: 'rgba(52,199,89,0.4)',
      backgroundColor: colors.background,
    },
    statCardDefault: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    statLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.mutedForeground,
    },
    statValue: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
    panel: {
      marginTop: 16,
      borderRadius: Radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 18,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 14,
    },
    panelTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
    },
    panelSub: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    spendBadge: {
      borderRadius: 999,
      backgroundColor: Brand.orangeMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    spendBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: Brand.orange,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 10,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    chartScroll: {
      minHeight: 160,
      alignItems: 'flex-end',
      gap: 4,
      paddingBottom: 4,
      flexGrow: 1,
    },
    barCol: {
      flexGrow: 1,
      flexBasis: 10,
      minWidth: 10,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    barPair: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
      height: 140,
    },
    barIn: {
      width: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(52,199,89,0.85)',
    },
    barOut: {
      width: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,106,0,0.85)',
    },
    muted: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    catList: { marginTop: 14, gap: 14 },
    catBlock: { gap: 6 },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    catLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    catValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
      fontVariant: ['tabular-nums'],
    },
    catTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    catFill: {
      height: '100%',
      borderRadius: 999,
    },
  });
}
