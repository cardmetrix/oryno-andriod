import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { LEGAL_WEBSITE } from '@/lib/legal';

type LinkRow = {
  id: string;
  title: string;
  amountFormatted: string;
  status: string;
  kind: string;
  slug: string;
};

export default function PaymentLinksScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const json = await api.get<{ links?: LinkRow[] }>(endpoints.paymentLinks.list);
      setRows(json.links ?? []);
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
          title="Payment Links"
          subtitle="Collect payments without creating an invoice"
          showBack
          right={
            <Pressable
              onPress={() => router.push('/(app)/payment-links/new' as never)}
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
                <Skeleton width={144} height={16} radius={999} />
                <Skeleton width={96} height={12} radius={999} />
              </View>
              <Skeleton width={80} height={20} radius={999} />
            </View>
          ))}
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : rows.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(280)} style={styles.empty}>
          <Ionicons name="link-outline" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No payment links yet</Text>
          <Text style={styles.emptySub}>
            Create a standalone link to get paid for anything.
          </Text>
          <Pressable
            style={styles.createBtn}
            onPress={() => router.push('/(app)/payment-links/new' as never)}>
            <Text style={styles.createText}>Create payment link</Text>
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
                onPress={() => void Linking.openURL(`${LEGAL_WEBSITE}/pay/${row.slug}`)}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title}>{row.title}</Text>
                  <Text style={styles.meta}>
                    {row.kind} · {row.status}
                  </Text>
                </View>
                <Text style={styles.amount}>{row.amountFormatted}</Text>
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
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowPressed: { opacity: 0.9 },
    title: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    meta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.mutedForeground,
    },
    amount: { fontSize: 15, fontWeight: '800', color: colors.foreground },
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
