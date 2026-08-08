import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PickerOptionList, PickerSheet } from '@/components/app/picker-sheet';
import { TransactionRow } from '@/components/app/transaction-row';
import { Screen } from '@/components/ui/screen';
import { TransactionListSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useTransactions } from '@/hooks/use-transactions';
import { useWallet } from '@/hooks/use-wallet';
import { alert } from '@/lib/alert';
import {
  buildHistoryMonths,
  collectCategories,
  filterHistoryItems,
  formatMoneyAmount,
  summarizeCashflow,
} from '@/lib/history';
import {
  confirmStatementSent,
  emailBankStatement,
  type StatementFormat,
} from '@/lib/statement';
import { groupTransactionsByDate } from '@/lib/transactions';

type SheetKind = 'category' | 'status' | 'month' | 'statement' | null;

export default function HistoryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { items, loading, error, refresh } = useTransactions();
  const { data: wallet } = useWallet();
  const { pulling, onRefresh } = usePullRefresh(refresh);

  const months = useMemo(() => buildHistoryMonths(items), [items]);
  const [monthKey, setMonthKey] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!months.length) return;
    if (!monthKey || !months.some((m) => m.key === monthKey)) {
      setMonthKey(months[0].key);
    }
  }, [months, monthKey]);

  const activeMonth = months.find((m) => m.key === monthKey) ?? months[0];
  const currency =
    wallet?.totals.currency ?? wallet?.primary.currency ?? items[0]?.currency ?? 'NGN';

  const categories = useMemo(() => collectCategories(items), [items]);

  const monthItems = useMemo(
    () =>
      filterHistoryItems(items, {
        monthKey: activeMonth?.key,
        category,
        status,
      }),
    [items, activeMonth?.key, category, status],
  );

  const totals = useMemo(() => summarizeCashflow(monthItems), [monthItems]);
  const groups = useMemo(() => groupTransactionsByDate(monthItems), [monthItems]);

  const categoryLabel =
    category === 'all'
      ? 'All Categories'
      : categories.find((c) => c.id === category)?.label ?? 'Category';
  const statusLabel =
    status === 'all'
      ? 'All Status'
      : status === 'successful'
        ? 'Successful'
        : status === 'pending'
          ? 'Pending'
          : 'Failed';

  async function onEmailStatement(format: StatementFormat) {
    setSheet(null);
    setDownloading(true);
    try {
      const result = await emailBankStatement({
        format,
        monthKey: activeMonth?.key,
      });
      confirmStatementSent(result);
    } catch (err) {
      alert.error(
        'Statement failed',
        err instanceof Error
          ? err.message
          : 'Could not email your statement. Please try again.',
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading && !items.length && !error) {
    return (
      <Screen scroll>
        <HistoryHeader downloading={false} onDownload={() => undefined} />
        <HistorySkeleton />
      </Screen>
    );
  }

  if (error && !items.length) {
    return (
      <Screen scroll>
        <HistoryHeader downloading={false} onDownload={() => undefined} />
        <View style={styles.stateCard}>
          <View style={styles.stateIcon}>
            <Ionicons name="cloud-offline-outline" size={26} color={Brand.error} />
          </View>
          <Text style={styles.stateTitle}>Couldn’t load history</Text>
          <Text style={styles.stateSub}>
            Check your connection and try again to load your transactions.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => void refresh()}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={pulling} onRefresh={onRefresh}>
      <HistoryHeader
        downloading={downloading}
        onDownload={() => setSheet('statement')}
      />

      <View style={styles.filterRow}>
        <FilterPill
          label={categoryLabel}
          onPress={() => setSheet('category')}
          active={category !== 'all'}
        />
        <FilterPill
          label={statusLabel}
          onPress={() => setSheet('status')}
          active={status !== 'all'}
        />
      </View>

      <View style={styles.monthBar}>
        <Pressable style={styles.monthBtn} onPress={() => setSheet('month')}>
          <Text style={styles.monthLabel}>{activeMonth?.label ?? '—'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.foreground} />
        </Pressable>
        <Pressable
          style={styles.analysisBtn}
          onPress={() =>
            router.push({
              pathname: '/(app)/history/analytics',
              params: { month: activeMonth?.key ?? '' },
            })
          }>
          <Ionicons name="pie-chart-outline" size={14} color={Brand.white} />
          <Text style={styles.analysisText}>Analysis</Text>
        </Pressable>
      </View>

      <View style={styles.cashflow}>
        <Text style={styles.cashflowText}>
          In{' '}
          <Text style={styles.cashflowIn}>
            {formatMoneyAmount(totals.inflow, currency)}
          </Text>
        </Text>
        <Text style={styles.cashflowText}>
          Out{' '}
          <Text style={styles.cashflowOut}>
            {formatMoneyAmount(totals.outflow, currency)}
          </Text>
        </Text>
      </View>

      <View style={styles.list}>
        {groups.length === 0 ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.stateCard}>
            <View style={[styles.stateIcon, { backgroundColor: Brand.orangeMuted }]}>
              <Ionicons name="receipt-outline" size={26} color={Brand.orange} />
            </View>
            <Text style={styles.stateTitle}>No transactions</Text>
            <Text style={styles.stateSub}>
              Nothing matches this month and filters. Try another period or clear filters.
            </Text>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setCategory('all');
                setStatus('all');
              }}>
              <Text style={styles.secondaryBtnText}>Clear filters</Text>
            </Pressable>
          </Animated.View>
        ) : (
          groups.map((group, groupIndex) => (
            <Animated.View
              key={group.date}
              entering={FadeInDown.delay(Math.min(groupIndex * 30, 180)).duration(260)}>
              {group.items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  item={tx}
                  timeStyle="absolute"
                  onPress={() => router.push(`/(app)/history/${tx.id}`)}
                />
              ))}
            </Animated.View>
          ))
        )}
      </View>

      <PickerSheet
        visible={sheet === 'category'}
        title="Category"
        subtitle="Filter by service type"
        onClose={() => setSheet(null)}>
        <PickerOptionList
          value={category}
          onChange={(id) => {
            setCategory(id);
            setSheet(null);
          }}
          options={[
            { id: 'all', title: 'All Categories' },
            ...categories.map((c) => ({ id: c.id, title: c.label })),
          ]}
        />
      </PickerSheet>

      <PickerSheet
        visible={sheet === 'status'}
        title="Status"
        subtitle="Filter by transaction result"
        onClose={() => setSheet(null)}>
        <PickerOptionList
          value={status}
          onChange={(id) => {
            setStatus(id);
            setSheet(null);
          }}
          options={[
            { id: 'all', title: 'All Status' },
            { id: 'successful', title: 'Successful' },
            { id: 'pending', title: 'Pending' },
            { id: 'failed', title: 'Failed' },
          ]}
        />
      </PickerSheet>

      <PickerSheet
        visible={sheet === 'month'}
        title="Month"
        subtitle="Choose a statement period"
        onClose={() => setSheet(null)}>
        <PickerOptionList
          value={activeMonth?.key ?? ''}
          onChange={(id) => {
            setMonthKey(id);
            setSheet(null);
          }}
          options={months.map((m) => ({
            id: m.key,
            title: m.longLabel,
            trailing: m.label,
          }))}
        />
      </PickerSheet>

      <PickerSheet
        visible={sheet === 'statement'}
        title="Email statement"
        subtitle={`We’ll send ${activeMonth?.longLabel ?? 'this month'} to your account email as PDF or Excel.`}
        onClose={() => setSheet(null)}>
        <PickerOptionList
          value=""
          onChange={(id) => {
            if (id === 'pdf' || id === 'xlsx') {
              void onEmailStatement(id);
            }
          }}
          options={[
            {
              id: 'pdf',
              title: 'PDF document',
              subtitle: 'Best for printing and records',
            },
            {
              id: 'xlsx',
              title: 'Excel spreadsheet',
              subtitle: 'Best for accounting and filters',
            },
          ]}
        />
      </PickerSheet>
    </Screen>
  );
}

function HistoryHeader({
  downloading,
  onDownload,
}: {
  downloading: boolean;
  onDownload: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.sub}>Wallet activity & statements</Text>
      </View>
      <Pressable
        style={styles.downloadBtn}
        onPress={onDownload}
        disabled={downloading}
        accessibilityLabel="Email bank statement">
        {downloading ? (
          <ActivityIndicator size="small" color={Brand.orange} />
        ) : (
          <Text style={styles.downloadText}>Download</Text>
        )}
      </Pressable>
    </View>
  );
}

function FilterPill({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterPill, active && styles.filterPillActive]}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={active ? Brand.orange : colors.mutedForeground}
      />
    </Pressable>
  );
}

function HistorySkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 14, marginTop: 8 }}>
      <View style={styles.filterRow}>
        <View style={[styles.filterPill, { opacity: 0.5, flex: 1 }]} />
        <View style={[styles.filterPill, { opacity: 0.5, flex: 1 }]} />
      </View>
      <View style={styles.monthBar}>
        <View style={[styles.boneMd, { width: 48 }]} />
        <View style={[styles.boneMd, { width: 88, height: 32, borderRadius: 999 }]} />
      </View>
      <TransactionListSkeleton count={5} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 4,
      marginBottom: 14,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.4,
    },
    sub: {
      marginTop: 4,
      fontSize: 13,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    downloadBtn: {
      minWidth: 84,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    downloadText: {
      fontSize: 14,
      fontWeight: '700',
      color: Brand.orange,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
    },
    filterPill: {
      flex: 1,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    filterPillActive: {
      borderColor: 'rgba(255,106,0,0.45)',
      backgroundColor: colors.orangeMuted,
    },
    filterPillText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    filterPillTextActive: {
      color: Brand.orange,
    },
    monthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    monthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingRight: 8,
    },
    monthLabel: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    analysisBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Brand.orange,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    analysisText: {
      color: Brand.white,
      fontSize: 13,
      fontWeight: '800',
    },
    cashflow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 10,
    },
    cashflowText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    cashflowIn: {
      color: Brand.success,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    cashflowOut: {
      color: colors.foreground,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    list: {
      marginTop: 4,
      gap: 2,
      paddingBottom: 8,
    },
    stateCard: {
      alignItems: 'center',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 24,
      paddingVertical: 40,
      marginTop: 12,
    },
    stateIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: 'rgba(255,59,48,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    stateTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    stateSub: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    primaryBtn: {
      marginTop: 16,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    primaryBtnText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    secondaryBtn: {
      marginTop: 16,
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    secondaryBtnText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
    boneMd: {
      height: 14,
      borderRadius: 999,
      backgroundColor: colors.muted,
    },
  });
}
