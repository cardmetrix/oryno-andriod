import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useProfile } from '@/hooks/use-profile';
import { api } from '@/lib/api';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { shareInvoicePdf } from '@/lib/invoice-pdf';
import { toast } from '@/lib/toast';

type Line = { description: string; quantity: string; unitPrice: string };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function NewInvoiceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode } = useProfile();
  const { user } = useUser();
  const currency = getCountryInfo(countryCode).currency;

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromAddress, setFromAddress] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [shipToName, setShipToName] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');

  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Due on receipt');
  const [poNumber, setPoNumber] = useState('');

  const [items, setItems] = useState<Line[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);
  const [taxRate, setTaxRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const name = user?.fullName ?? '';
    const email = user?.primaryEmailAddress?.emailAddress ?? '';
    if (name) setFromName((prev) => prev || name);
    if (email) setFromEmail((prev) => prev || email);
  }, [user]);

  const totals = useMemo(() => {
    const lineAmounts = items.map((item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      return round2(quantity * unitPrice);
    });
    const subtotal = round2(lineAmounts.reduce((sum, n) => sum + n, 0));
    const disc = Math.max(0, round2(Number(discount) || 0));
    const ship = Math.max(0, round2(Number(shipping) || 0));
    const rate = Math.max(0, Number(taxRate) || 0);
    const taxable = Math.max(0, subtotal - disc);
    const tax = round2((taxable * rate) / 100);
    const total = round2(taxable + tax + ship);
    const paid = Math.max(0, round2(Number(amountPaid) || 0));
    return {
      subtotal,
      tax,
      total,
      amountPaid: paid,
      balanceDue: round2(Math.max(0, total - paid)),
    };
  }, [items, taxRate, discount, shipping, amountPaid]);

  async function onSubmit(mode: 'send' | 'pdf') {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (items.some((item) => !item.description.trim())) {
      toast.error('Each line needs a description');
      return;
    }
    setSaving(true);
    try {
      const json = await api.post<{
        invoice?: { id: string; number?: string };
        error?: string;
      }>(endpoints.invoices.list, {
        status: 'sent',
        currency,
        fromName,
        fromEmail,
        fromPhone,
        fromAddress,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        shipToName,
        shipToAddress,
        issuedAt,
        dueAt: dueAt || null,
        paymentTerms,
        poNumber,
        notes,
        terms,
        taxRate: Number(taxRate) || 0,
        discount: Number(discount) || 0,
        shipping: Number(shipping) || 0,
        amountPaid: Number(amountPaid) || 0,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      });
      if (!json.invoice?.id) throw new Error(json.error || 'Failed');

      if (mode === 'pdf') {
        await shareInvoicePdf(json.invoice.id, json.invoice.number);
        toast.success('Invoice created and PDF downloaded');
      } else {
        toast.success('Invoice created');
      }

      router.replace({
        pathname: '/(app)/invoices/[id]',
        params: { id: json.invoice.id },
      } as never);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
      header={
        <PageHeader
          title="Invoice Generator"
          subtitle="Create professional invoices with one click"
          showBack
        />
      }>
      <View style={styles.card}>
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerTitle}>INVOICE</Text>
            <Text style={styles.bannerSub}># Auto-assigned</Text>
          </View>
          <View style={styles.freeBadge}>
            <Text style={styles.freeText}>FREE</Text>
          </View>
        </View>

        <View style={styles.body}>
          <PartyColumn
            styles={styles}
            colors={colors}
            title="Who is this from?">
            <TextInput
              value={fromName}
              onChangeText={setFromName}
              placeholder="Your business name"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={fromEmail}
              onChangeText={setFromEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={fromPhone}
              onChangeText={setFromPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={fromAddress}
              onChangeText={setFromAddress}
              placeholder="Address"
              multiline
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, styles.area]}
            />
          </PartyColumn>

          <PartyColumn styles={styles} colors={colors} title="Bill To">
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Who is this to?"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={customerEmail}
              onChangeText={setCustomerEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Billing address"
              multiline
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, styles.area]}
            />
          </PartyColumn>

          <PartyColumn styles={styles} colors={colors} title="Ship To (optional)">
            <TextInput
              value={shipToName}
              onChangeText={setShipToName}
              placeholder="Recipient name"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={shipToAddress}
              onChangeText={setShipToAddress}
              placeholder="Shipping address"
              multiline
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, styles.areaTall]}
            />
          </PartyColumn>

          <View style={styles.metaGrid}>
            <MetaField styles={styles} colors={colors} label="Date">
              <TextInput
                value={issuedAt}
                onChangeText={setIssuedAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
            </MetaField>
            <MetaField styles={styles} colors={colors} label="Payment Terms">
              <TextInput
                value={paymentTerms}
                onChangeText={setPaymentTerms}
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
            </MetaField>
            <MetaField styles={styles} colors={colors} label="Due Date">
              <TextInput
                value={dueAt}
                onChangeText={setDueAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
            </MetaField>
            <MetaField styles={styles} colors={colors} label="PO Number">
              <TextInput
                value={poNumber}
                onChangeText={setPoNumber}
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
            </MetaField>
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.colHead, { flex: 1 }]}>Item</Text>
            <Text style={[styles.colHead, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.colHead, styles.rateCol]}>Rate</Text>
          </View>
          {items.map((item, idx) => {
            const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            return (
              <View key={idx} style={styles.line}>
                <TextInput
                  value={item.description}
                  onChangeText={(value) => {
                    const next = [...items];
                    next[idx] = { ...item, description: value };
                    setItems(next);
                  }}
                  placeholder="Description of item/service..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  value={item.quantity}
                  onChangeText={(value) => {
                    const next = [...items];
                    next[idx] = { ...item, quantity: value };
                    setItems(next);
                  }}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.qtyCol]}
                />
                <TextInput
                  value={item.unitPrice}
                  onChangeText={(value) => {
                    const next = [...items];
                    next[idx] = { ...item, unitPrice: value };
                    setItems(next);
                  }}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, styles.rateCol]}
                />
                <Text style={styles.amount}>{money(amount, currency)}</Text>
                <Pressable
                  disabled={items.length <= 1}
                  onPress={() => setItems(items.filter((_, i) => i !== idx))}
                  style={[styles.trash, items.length <= 1 && { opacity: 0.3 }]}>
                  <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          })}

          <Pressable
            onPress={() =>
              setItems([...items, { description: '', quantity: '1', unitPrice: '' }])
            }
            style={styles.addLine}>
            <Ionicons name="add" size={16} color={Brand.orange} />
            <Text style={styles.addLineText}>Line Item</Text>
          </Pressable>

          <View style={styles.notesBlock}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes - any relevant information not already covered"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.input, styles.areaTall]}
            />
            <Text style={styles.fieldLabel}>Terms</Text>
            <TextInput
              value={terms}
              onChangeText={setTerms}
              placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.input, styles.areaTall]}
            />
          </View>

          <View style={styles.totals}>
            <TotalsRow styles={styles} label="Subtotal" value={money(totals.subtotal, currency)} />
            <AdjustRow
              styles={styles}
              colors={colors}
              label="Tax %"
              value={taxRate}
              onChange={setTaxRate}
              width={96}
            />
            <TotalsRow styles={styles} label="Tax" value={money(totals.tax, currency)} />
            <AdjustRow
              styles={styles}
              colors={colors}
              label="Discount"
              value={discount}
              onChange={setDiscount}
            />
            <AdjustRow
              styles={styles}
              colors={colors}
              label="Shipping"
              value={shipping}
              onChange={setShipping}
            />
            <TotalsRow styles={styles} label="Total" value={money(totals.total, currency)} bold />
            <AdjustRow
              styles={styles}
              colors={colors}
              label="Amount Paid"
              value={amountPaid}
              onChange={setAmountPaid}
            />
            <TotalsRow
              styles={styles}
              label="Balance Due"
              value={money(totals.balanceDue, currency)}
              bold
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            disabled={saving}
            onPress={() => void onSubmit('send')}
            style={[styles.primaryBtn, saving && styles.disabled]}>
            <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save & Send'}</Text>
          </Pressable>
          <Pressable
            disabled={saving}
            onPress={() => void onSubmit('pdf')}
            style={[styles.secondaryBtn, saving && styles.disabled]}>
            <Ionicons name="download-outline" size={16} color={colors.foreground} />
            <Text style={styles.secondaryText}>Download PDF</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function PartyColumn({
  title,
  children,
  styles,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.party}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function MetaField({
  label,
  children,
  styles,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.metaField}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function TotalsRow({
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
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, bold && styles.totalsBold]}>{label}</Text>
      <Text style={[styles.totalsValue, bold && styles.totalsBold]}>{value}</Text>
    </View>
  );
}

function AdjustRow({
  label,
  value,
  onChange,
  styles,
  colors,
  width = 112,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  width?: number;
}) {
  return (
    <View style={styles.totalsRow}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={[styles.adjust, { width, color: colors.foreground, borderColor: colors.border }]}
      />
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
      overflow: 'hidden',
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    bannerTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: colors.foreground,
    },
    bannerSub: { fontSize: 12, color: colors.mutedForeground },
    freeBadge: {
      borderRadius: 999,
      backgroundColor: Brand.orangeMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    freeText: { fontSize: 10, fontWeight: '800', color: Brand.orange },
    body: { padding: 16, gap: 16 },
    party: { gap: 6 },
    metaGrid: { gap: 12 },
    metaField: { gap: 6 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    area: { minHeight: 64, textAlignVertical: 'top' },
    areaTall: { minHeight: 88, textAlignVertical: 'top' },
    tableHead: { flexDirection: 'row', gap: 8, paddingBottom: 6 },
    colHead: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
    qtyCol: { width: 64 },
    rateCol: { width: 88 },
    line: { gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    amount: {
      textAlign: 'right',
      fontWeight: '700',
      fontSize: 14,
      color: colors.foreground,
    },
    trash: {
      alignSelf: 'flex-end',
      borderRadius: 8,
      padding: 8,
    },
    addLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    addLineText: { fontSize: 14, fontWeight: '700', color: Brand.orange },
    notesBlock: { gap: 8 },
    totals: {
      gap: 8,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      padding: 16,
    },
    totalsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    totalsLabel: { fontSize: 14, color: colors.mutedForeground },
    totalsValue: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    totalsBold: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    adjust: {
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      textAlign: 'right',
      fontSize: 14,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    primaryBtn: {
      height: 44,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
    secondaryBtn: {
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryText: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
    disabled: { opacity: 0.5 },
  });
}
