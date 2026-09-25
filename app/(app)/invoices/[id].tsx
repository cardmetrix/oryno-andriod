import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { LEGAL_WEBSITE } from '@/lib/legal';
import { toast } from '@/lib/toast';

type Packed = {
  invoice: {
    id: string;
    number: string;
    customerName: string;
    customerEmail: string | null;
    currency: string;
    total: string;
    notes: string | null;
    status: string;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
  paymentLink: { slug: string; status: string } | null;
  url?: string;
};

const FOOTER = 'Powered by ORYNO — Your Digital World, Simplified.';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = typeof id === 'string' ? id : id?.[0] ?? '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState<Packed | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const json = await api.get<Packed>(endpoints.invoices.detail(invoiceId));
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const payUrl =
    data?.url ??
    (data?.paymentLink
      ? `${LEGAL_WEBSITE}/pay/${data.paymentLink.slug}`
      : null);

  async function createLink() {
    if (!invoiceId) return;
    setLinking(true);
    try {
      const json = await api.post<Packed & { error?: string }>(
        endpoints.invoices.paymentLink(invoiceId),
        {},
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              paymentLink: json.paymentLink ?? prev.paymentLink,
              url: json.url ?? prev.url,
              invoice: json.invoice ?? prev.invoice,
              items: json.items ?? prev.items,
            }
          : json,
      );
      const url =
        json.url ??
        (json.paymentLink
          ? `${LEGAL_WEBSITE}/pay/${json.paymentLink.slug}`
          : null);
      if (url) {
        await Clipboard.setStringAsync(url);
        toast.success('Payment link created and copied');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setLinking(false);
    }
  }

  async function copyLink() {
    if (!payUrl) return;
    await Clipboard.setStringAsync(payUrl);
    toast.success('Link copied');
  }

  async function shareLink() {
    if (!payUrl || !data) return;
    try {
      await Share.share({
        message: `Pay invoice ${data.invoice.number}: ${payUrl}`,
        url: payUrl,
      });
    } catch {
      await copyLink();
    }
  }

  if (loading && !data) {
    return (
      <Screen header={<PageHeader title="Invoice" showBack />}>
        <FormSkeleton />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen header={<PageHeader title="Invoice" showBack />}>
        <Text style={[styles.error, { color: Brand.error }]}>Invoice not found</Text>
      </Screen>
    );
  }

  const { invoice, items } = data;

  return (
    <Screen
      scroll
      footer={
        payUrl ? (
          <View style={styles.footerActions}>
            <Button title="Copy payment link" variant="secondary" onPress={() => void copyLink()} />
            <Button title="Share link" onPress={() => void shareLink()} />
          </View>
        ) : (
          <Button
            title={linking ? 'Creating link…' : 'Create payment link'}
            loading={linking}
            disabled={linking || invoice.status === 'paid'}
            onPress={() => void createLink()}
          />
        )
      }
      header={
        <PageHeader
          title={invoice.number}
          subtitle={invoice.customerName}
          showBack
        />
      }>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={styles.metaValue}>{invoice.status}</Text>
        </View>
        {invoice.customerEmail ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Email</Text>
            <Text style={styles.metaValue}>{invoice.customerEmail}</Text>
          </View>
        ) : null}
        <View style={[styles.metaRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {invoice.currency} {invoice.total}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.itemsCard}>
        <Text style={styles.sectionTitle}>Line items</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemDesc}>{item.description}</Text>
              <Text style={styles.itemSub}>
                {item.quantity} × {invoice.currency} {item.unitPrice}
              </Text>
            </View>
            <Text style={styles.itemAmount}>
              {invoice.currency} {item.amount}
            </Text>
          </View>
        ))}
      </View>

      {invoice.notes ? (
        <View style={styles.notesCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesBody}>{invoice.notes}</Text>
        </View>
      ) : null}

      {payUrl ? (
        <Pressable style={styles.linkCard} onPress={() => void copyLink()}>
          <Ionicons name="link-outline" size={18} color={Brand.orange} />
          <Text style={styles.linkText} numberOfLines={2}>
            {payUrl}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.footer}>{FOOTER}</Text>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      gap: 10,
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    metaLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
    metaValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
      textTransform: 'capitalize',
    },
    totalRow: {
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    totalLabel: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    totalValue: { fontSize: 16, fontWeight: '800', color: Brand.orange },
    itemsCard: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.mutedForeground,
      marginBottom: 10,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemDesc: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    itemSub: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    itemAmount: { fontSize: 13, fontWeight: '800', color: colors.foreground },
    notesCard: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      marginBottom: 12,
    },
    notesBody: { fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 20 },
    linkCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,106,0,0.25)',
      backgroundColor: colors.orangeMuted,
      padding: 12,
      marginBottom: 12,
    },
    linkText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.foreground },
    footer: {
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    footerActions: { gap: 8 },
    error: { marginTop: 16, textAlign: 'center', fontWeight: '700' },
  });
}
