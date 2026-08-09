import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { PickerOptionList, PickerSheet } from '@/components/app/picker-sheet';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useTransactions } from '@/hooks/use-transactions';
import { useWallet } from '@/hooks/use-wallet';
import {
  buildCategoryBreakdown,
  buildDailySeries,
  buildHistoryMonths,
  filterHistoryItems,
  formatMoneyAmount,
  summarizeCashflow,
} from '@/lib/history';

export default function HistoryAnalyticsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ month?: string }>();
  const { items, loading, refresh } = useTransactions();
  const { data: wallet } = useWallet();
  const { pulling, onRefresh } = usePullRefresh(refresh);

  const months = useMemo(() => buildHistoryMonths(items), [items]);
  const [monthKey, setMonthKey] = useState(params.month ?? '');
  const [monthSheet, setMonthSheet] = useState(false);

  useEffect(() => {
    if (!months.length) return;
    if (!monthKey || !months.some((m) => m.key === monthKey)) {
      setMonthKey(params.month && months.some((m) => m.key === params.month) ? params.month : months[0].key);
    }
  }, [months, monthKey, params.month]);

  const activeMonth = months.find((m) => m.key === monthKey) ?? months[0];
  const currency =
    wallet?.totals.currency ?? wallet?.primary.currency ?? items[0]?.currency ?? 'NGN';

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

  const maxBar = Math.max(
    1,
    ...series.map((p) => Math.max(p.inflow, p.outflow)),
  );
  const maxCategory = Math.max(1, ...categories.map((c) => c.total));
  const spendShare =
    totals.inflow + totals.outflow > 0
      ? totals.outflow / (totals.inflow + totals.outflow)
      : 0;

  return (
    <Screen scroll refreshing={pulling} onRefresh={onRefresh}>
      <PageHeader
        title="Analysis"
        subtitle={activeMonth?.longLabel ?? 'Spending insights'}
        showBack
        right={
          <Pressable style={styles.monthChip} onPress={() => setMonthSheet(true)}>
            <Text style={styles.monthChipText}>{activeMonth?.label ?? '—'}</Text>
            <Ionicons name="chevron-down" size={14} color={Brand.orange} />
          </Pressable>
        }
      />

      {loading && !items.length ? (
        <View style={styles.panel}>
          <Text style={styles.muted}>Loading insights…</Text>
        </View>
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
            <Text style={styles.heroLabel}>Net cash flow</Text>
            <Text
              style={[
                styles.heroValue,
                { color: totals.net >= 0 ? Brand.success : colors.foreground },
              ]}>
              {formatMoneyAmount(Math.abs(totals.net), currency, {
                signed: true,
                type: totals.net >= 0 ? 'credit' : 'debit',
              })}
            </Text>
            <Text style={styles.heroSub}>
              {totals.count} transaction{totals.count === 1 ? '' : 's'} this month
            </Text>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>In</Text>
                <Text style={[styles.heroStatValue, { color: Brand.success }]}>
                  {formatMoneyAmount(totals.inflow, currency)}
                </Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Out</Text>
                <Text style={styles.heroStatValue}>
                  {formatMoneyAmount(totals.outflow, currency)}
                </Text>
              </View>
            </View>

            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${Math.round((1 - spendShare) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.trackHint}>
              {Math.round((1 - spendShare) * 100)}% inflow · {Math.round(spendShare * 100)}% outflow
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(60).duration(280)}
            style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Daily activity</Text>
              <Text style={styles.muted}>In vs out</Text>
            </View>
            <View style={styles.chart}>
              {series.map((point) => {
                const inH = Math.max(2, (point.inflow / maxBar) * 72);
                const outH = Math.max(2, (point.outflow / maxBar) * 72);
                const showLabel = Number(point.label) % 5 === 1 || point.label === '1';
                return (
                  <View key={point.key} style={styles.barCol}>
                    <View style={styles.barPair}>
                      <View style={[styles.barIn, { height: point.inflow ? inH : 2 }]} />
                      <View style={[styles.barOut, { height: point.outflow ? outH : 2 }]} />
                    </View>
                    {showLabel ? <Text style={styles.barLabel}>{point.label}</Text> : null}
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Brand.success }]} />
                <Text style={styles.muted}>In</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Brand.orange }]} />
                <Text style={styles.muted}>Out</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(100).duration(280)}
            style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>By category</Text>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.link}>View list</Text>
              </Pressable>
            </View>

            {categories.length === 0 ? (
              <Text style={styles.muted}>No activity in this month yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {categories.map((cat, index) => (
                  <View key={cat.id}>
                    <View style={styles.catRow}>
                      <Text style={styles.catLabel} numberOfLines={1}>
                        {cat.label}
                      </Text>
                      <Text style={styles.catValue}>
                        {formatMoneyAmount(cat.total, currency)}
                      </Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View
                        style={[
                          styles.catFill,
                          {
                            width: `${Math.max(6, Math.round((cat.total / maxCategory) * 100))}%`,
                            backgroundColor: index % 2 === 0 ? Brand.orange : Brand.success,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.catMeta}>
                      {cat.count} txn · In {formatMoneyAmount(cat.inflow, currency)} · Out{' '}
                      {formatMoneyAmount(cat.outflow, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(140).duration(280)}
            style={styles.panel}>
            <Text style={styles.panelTitle}>Top activity</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              {monthItems.slice(0, 5).map((tx) => (
                <Pressable
                  key={tx.id}
                  style={styles.topRow}
                  onPress={() => router.push(`/(app)/history/${tx.id}`)}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.topTitle} numberOfLines={1}>
                      {tx.title}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {tx.subtitle || tx.category || 'Transaction'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.topAmount,
                      tx.type === 'credit' && { color: Brand.success },
                    ]}>
                    {tx.amount}
                  </Text>
                </Pressable>
              ))}
              {monthItems.length === 0 ? (
                <Text style={styles.muted}>Fund your wallet or pay a bill to see insights.</Text>
              ) : null}
            </View>
          </Animated.View>
        </>
      )}

      <PickerSheet
        visible={monthSheet}
        title="Month"
        subtitle="Analysis period"
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    monthChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,106,0,0.35)',
      backgroundColor: colors.orangeMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    monthChipText: {
      fontSize: 13,
      fontWeight: '800',
      color: Brand.orange,
    },
    hero: {
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroValue: {
      marginTop: 6,
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    heroSub: {
      marginTop: 4,
      fontSize: 13,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    heroStats: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroStat: { flex: 1 },
    heroStatLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    heroStatValue: {
      marginTop: 2,
      fontSize: 16,
      fontWeight: '800',
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
    heroDivider: {
      width: StyleSheet.hairlineWidth,
      height: 36,
      backgroundColor: colors.border,
      marginHorizontal: 12,
    },
    track: {
      marginTop: 12,
      height: 8,
      borderRadius: 999,
      backgroundColor: Brand.orange,
      overflow: 'hidden',
    },
    trackFill: {
      height: '100%',
      backgroundColor: Brand.success,
      borderRadius: 999,
    },
    trackHint: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    panel: {
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    panelTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.foreground,
    },
    muted: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    link: {
      fontSize: 13,
      fontWeight: '700',
      color: Brand.orange,
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 2,
      height: 96,
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 0,
    },
    barPair: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 1,
      height: 80,
    },
    barIn: {
      width: 3,
      borderRadius: 2,
      backgroundColor: Brand.success,
      minHeight: 2,
    },
    barOut: {
      width: 3,
      borderRadius: 2,
      backgroundColor: Brand.orange,
      minHeight: 2,
    },
    barLabel: {
      marginTop: 4,
      fontSize: 8,
      color: colors.mutedForeground,
      fontWeight: '600',
    },
    legend: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 10,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    catLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    catValue: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
    catTrack: {
      marginTop: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    catFill: {
      height: '100%',
      borderRadius: 999,
    },
    catMeta: {
      marginTop: 4,
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    topAmount: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
  });
}
