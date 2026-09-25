import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

type InvoiceRow = {
  id: string;
  number: string;
  customerName: string;
  totalFormatted: string;
  status: string;
};

export default function InvoicesListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<{ invoices?: InvoiceRow[] }>(
        endpoints.invoices.list,
      );
      setRows(json.invoices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={load}
      footer={
        !loading ? (
          <Button
            title="New invoice"
            onPress={() => router.push('/(app)/invoices/new' as never)}
          />
        ) : null
      }
      header={
        <PageHeader
          title="Invoices"
          subtitle="Create free professional invoices"
          showBack
        />
      }>
      {loading && rows.length === 0 ? (
        <FormSkeleton />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(280)} style={styles.empty}>
          <Ionicons name="document-text-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No invoices yet</Text>
          <Text style={styles.emptySub}>
            Create a free invoice and share a payment link with your customer.
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <Animated.View
              key={row.id}
              entering={FadeInDown.delay(index * 30).duration(240)}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/invoices/[id]',
                    params: { id: row.id },
                  } as never)
                }>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowNumber}>{row.number}</Text>
                  <Text style={styles.rowCustomer} numberOfLines={1}>
                    {row.customerName}
                  </Text>
                </View>
                <View style={styles.rowTrailing}>
                  <Text style={styles.rowAmount}>{row.totalFormatted}</Text>
                  <Text style={styles.rowStatus}>{row.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowPressed: { backgroundColor: colors.muted },
    rowNumber: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    rowCustomer: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    rowTrailing: { alignItems: 'flex-end' },
    rowAmount: { fontSize: 13, fontWeight: '800', color: colors.foreground },
    rowStatus: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
      textTransform: 'capitalize',
    },
    empty: {
      alignItems: 'center',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      padding: 28,
      gap: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    emptySub: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 18,
    },
    errorCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      alignItems: 'center',
      gap: 10,
    },
    errorText: { fontSize: 13, fontWeight: '600', color: Brand.error, textAlign: 'center' },
    retry: { fontSize: 14, fontWeight: '800', color: Brand.orange },
  });
}
