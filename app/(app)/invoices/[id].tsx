import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { shareInvoicePdf } from '@/lib/invoice-pdf';
import { LEGAL_WEBSITE } from '@/lib/legal';
import { toast } from '@/lib/toast';

type Packed = {
  invoice: {
    id: string;
    number: string;
    fromName: string | null;
    fromEmail: string | null;
    fromPhone: string | null;
    fromAddress: string | null;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    shipToName: string | null;
    shipToAddress: string | null;
    notes: string | null;
    terms: string | null;
    paymentTerms: string | null;
    poNumber: string | null;
    status: string;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
  summary: {
    subtotalFormatted: string;
    taxFormatted: string;
    taxRate: number;
    discountFormatted: string;
    discount: number;
    shippingFormatted: string;
    shipping: number;
    totalFormatted: string;
    amountPaidFormatted: string;
    amountPaid: number;
    balanceDueFormatted: string;
    issuedAt: string;
    dueAt: string | null;
  };
  paymentLink: { slug: string; status: string } | null;
  url?: string;
};

const FOOTER = 'Powered by ORYNO - Your Digital World, Simplified.';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = typeof id === 'string' ? id : id?.[0] ?? '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState<Packed | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
    (data?.paymentLink ? `${LEGAL_WEBSITE}/pay/${data.paymentLink.slug}` : null);

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
              summary: json.summary ?? prev.summary,
            }
          : json,
      );
      const url =
        json.url ??
        (json.paymentLink ? `${LEGAL_WEBSITE}/pay/${json.paymentLink.slug}` : null);
      if (url) {
        await Clipboard.setStringAsync(url);
        toast.success('Payment link created and copied');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLinking(false);
    }
  }

  async function downloadPdf() {
    if (!data) return;
    setDownloading(true);
    try {
      await shareInvoicePdf(data.invoice.id, data.invoice.number);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setDownloading(false);
    }
  }

  if (loading && !data) {
    return (
      <Screen header={<PageHeader title="Invoice" showBack />}>
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={{ gap: 8 }}>
              <Skeleton width={140} height={28} radius={8} />
              <Skeleton width={110} height={16} radius={999} />
            </View>
            <Skeleton width={64} height={28} radius={999} />
          </View>
          <View style={styles.metaGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ gap: 6 }}>
                <Skeleton width={64} height={12} radius={999} />
                <Skeleton width={96} height={16} radius={999} />
              </View>
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen header={<PageHeader title="Invoice" showBack />}>
        <Text style={styles.error}>Invoice not found</Text>
      </Screen>
    );
  }

  const { invoice, items, summary } = data;
  const taxVisible =
    summary.taxRate > 0 ||
    Number(String(summary.taxFormatted).replace(/[^\d.-]/g, '')) > 0;

  return (
    <Screen
      scroll
      header={
        <PageHeader
          title={invoice.number}
          subtitle={`${invoice.customerName} · ${invoice.status}`}
          showBack
          right={
            <Pressable
              disabled={downloading}
              onPress={() => void downloadPdf()}
              style={styles.pdfBtn}>
              <Ionicons name="download-outline" size={16} color={colors.foreground} />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </Pressable>
          }
        />
      }>
      <View style={styles.card}>
        <View style={styles.head}>
          <View>
            <Text style={styles.invoiceWord}>INVOICE</Text>
            <Text style={styles.invoiceNumber}># {invoice.number}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{invoice.status}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <Meta styles={styles} label="Date" value={fmtDate(summary.issuedAt)} />
          <Meta styles={styles} label="Payment Terms" value={invoice.paymentTerms || '-'} />
          <Meta styles={styles} label="Due Date" value={fmtDate(summary.dueAt)} />
          <Meta styles={styles} label="PO Number" value={invoice.poNumber || '-'} />
        </View>

        <View style={styles.parties}>
          <Party
            styles={styles}
            label="From"
            name={invoice.fromName}
            lines={[invoice.fromEmail, invoice.fromPhone, invoice.fromAddress]}
          />
          <Party
            styles={styles}
            label="Bill To"
            name={invoice.customerName}
            lines={[invoice.customerEmail, invoice.customerPhone, invoice.customerAddress]}
          />
          <Party
            styles={styles}
            label="Ship To"
            name={invoice.shipToName}
            lines={[invoice.shipToAddress]}
          />
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.col, { flex: 1 }]}>Item</Text>
          <Text style={[styles.col, styles.qty]}>Qty</Text>
          <Text style={[styles.col, styles.rate]}>Rate</Text>
          <Text style={[styles.col, styles.amt]}>Amount</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={[styles.itemText, { flex: 1 }]}>{item.description}</Text>
            <Text style={[styles.itemText, styles.qty]}>{Number(item.quantity)}</Text>
            <Text style={[styles.itemText, styles.rate]}>{item.unitPrice}</Text>
            <Text style={[styles.itemAmount, styles.amt]}>{item.amount}</Text>
          </View>
        ))}

        <View style={styles.summary}>
          <SumRow styles={styles} label="Subtotal" value={summary.subtotalFormatted} />
          {summary.discount > 0 ? (
            <SumRow styles={styles} label="Discount" value={`-${summary.discountFormatted}`} />
          ) : null}
          {taxVisible ? (
            <SumRow
              styles={styles}
              label={`Tax (${summary.taxRate}%)`}
              value={summary.taxFormatted}
            />
          ) : null}
          {summary.shipping > 0 ? (
            <SumRow styles={styles} label="Shipping" value={summary.shippingFormatted} />
          ) : null}
          <SumRow styles={styles} label="Total" value={summary.totalFormatted} bold />
          {summary.amountPaid > 0 ? (
            <SumRow styles={styles} label="Amount Paid" value={summary.amountPaidFormatted} />
          ) : null}
          <SumRow styles={styles} label="Balance Due" value={summary.balanceDueFormatted} bold />
        </View>

        {invoice.notes ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Notes</Text>
            <Text style={styles.noteBody}>{invoice.notes}</Text>
          </View>
        ) : null}
        {invoice.terms ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Terms</Text>
            <Text style={styles.noteBody}>{invoice.terms}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>{FOOTER}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={downloading}
          onPress={() => void downloadPdf()}
          style={[styles.secondaryBtn, downloading && styles.disabled]}>
          <Ionicons name="download-outline" size={16} color={colors.foreground} />
          <Text style={styles.secondaryText}>Download PDF</Text>
        </Pressable>
        <Pressable
          disabled={linking}
          onPress={() => void createLink()}
          style={[styles.primaryBtn, linking && styles.disabled]}>
          <Ionicons name="link-outline" size={16} color={Brand.white} />
          <Text style={styles.primaryText}>
            {data.paymentLink ? 'Copy payment link' : 'Create payment link'}
          </Text>
        </Pressable>
        {payUrl ? <Text style={styles.payUrl}>{payUrl}</Text> : null}
        <Text style={styles.hint}>
          Payment links are separate from the invoice PDF. Share either or both.
        </Text>
      </View>
    </Screen>
  );
}

function Meta({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Party({
  label,
  name,
  lines,
  styles,
}: {
  label: string;
  name: string | null | undefined;
  lines: (string | null | undefined)[];
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.partyName}>{name || '-'}</Text>
      {lines.filter(Boolean).map((line) => (
        <Text key={String(line)} style={styles.partyLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function SumRow({
  label,
  value,
  bold,
  styles,
}: {
  label: string;
  value: string;
  bold?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && styles.sumBold]}>{label}</Text>
      <Text style={[styles.sumValue, bold && styles.sumBold]}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 16,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    invoiceWord: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.foreground,
    },
    invoiceNumber: { marginTop: 2, fontSize: 14, color: colors.mutedForeground },
    statusPill: {
      borderRadius: 999,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      color: colors.foreground,
    },
    metaGrid: { marginTop: 16, gap: 10 },
    meta: { gap: 2 },
    metaLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.mutedForeground,
    },
    metaValue: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    parties: { marginTop: 20, gap: 16 },
    partyName: { marginTop: 4, fontSize: 14, fontWeight: '700', color: colors.foreground },
    partyLine: { fontSize: 12, color: colors.mutedForeground },
    tableHead: {
      marginTop: 20,
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    col: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    qty: { width: 36, textAlign: 'right' },
    rate: { width: 72, textAlign: 'right' },
    amt: { width: 80, textAlign: 'right' },
    itemRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemText: { fontSize: 14, color: colors.foreground },
    itemAmount: { fontSize: 14, fontWeight: '700', color: colors.foreground, textAlign: 'right' },
    summary: { marginTop: 16, gap: 6 },
    sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    sumLabel: { fontSize: 14, color: colors.mutedForeground },
    sumValue: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    sumBold: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    noteBlock: { marginTop: 20 },
    noteLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.mutedForeground,
    },
    noteBody: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.foreground },
    footer: {
      marginTop: 24,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      textAlign: 'center',
      fontSize: 11,
      color: colors.mutedForeground,
    },
    actions: { marginTop: 16, gap: 12 },
    primaryBtn: {
      height: 44,
      borderRadius: Radius.lg,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
    secondaryBtn: {
      height: 44,
      borderRadius: Radius.lg,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryText: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
    pdfBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
    },
    pdfBtnText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    payUrl: { textAlign: 'center', fontSize: 12, color: colors.mutedForeground },
    hint: { textAlign: 'center', fontSize: 11, color: colors.mutedForeground },
    disabled: { opacity: 0.5 },
    error: { marginTop: 16, textAlign: 'center', fontWeight: '700', color: Brand.error },
  });
}
