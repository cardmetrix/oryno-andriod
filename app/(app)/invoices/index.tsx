import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
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
    setError(null);
    try {
      const json = await api.get<{ invoices?: InvoiceRow[] }>(
        endpoints.invoices.list,
      );
      setRows(json.invoices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
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
      refreshing={loading && rows.length > 0}
      onRefresh={() => {
        setLoading(true);
        void load();
      }}
      header={
        <PageHeader
          title="Invoice Generator"
          subtitle="Create free professional invoices and download PDFs"
          showBack
          right={
            <Pressable
              onPress={() => router.push('/(app)/invoices/new' as never)}
              style={styles.newBtn}>
              <Ionicons name="add" size={16} color={Brand.white} />
              <Text style={styles.newBtnText}>New</Text>
            </Pressable>
          }
        />
      }>
      {loading && rows.length === 0 ? (
        <View style={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.row}>
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width={128} height={16} radius={999} />
                <Skeleton width={160} height={12} radius={999} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Skeleton width={80} height={16} radius={999} />
                <Skeleton width={56} height={12} radius={999} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : rows.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(280)} style={styles.empty}>
          <Ionicons name="document-text-outline" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No invoices yet</Text>
          <Text style={styles.emptySub}>
            Create a free invoice and share a payment link.
          </Text>
          <Pressable
            style={styles.createBtn}
            onPress={() => router.push('/(app)/invoices/new' as never)}>
            <Text style={styles.createText}>Create invoice</Text>
          </Pressable>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowPressed: { opacity: 0.9 },
    rowNumber: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    rowCustomer: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    rowTrailing: { alignItems: 'flex-end' },
    rowAmount: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    rowStatus: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
      textTransform: 'capitalize',
    },
    empty: {
      alignItems: 'center',
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      padding: 32,
    },
    emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.foreground },
    emptySub: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 20,
    },
    createBtn: {
      marginTop: 16,
      borderRadius: 12,
      backgroundColor: Brand.orange,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    createText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 12,
      backgroundColor: Brand.orange,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    newBtnText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
    errorText: { fontSize: 14, fontWeight: '600', color: Brand.error },
  });
}
