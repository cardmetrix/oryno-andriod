import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useProfile } from '@/hooks/use-profile';
import { api } from '@/lib/api';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type Line = { description: string; quantity: string; unitPrice: string };

export default function NewInvoiceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode } = useProfile();
  const currency = getCountryInfo(countryCode).currency;

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Line[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    const name = customerName.trim();
    if (!name) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      const json = await api.post<{
        invoice?: { id: string };
        error?: string;
      }>(endpoints.invoices.list, {
        customerName: name,
        customerEmail: customerEmail.trim() || undefined,
        notes: notes.trim() || undefined,
        currency,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      });
      if (!json.invoice?.id) throw new Error(json.error || 'Failed to create invoice');
      toast.success('Invoice created');
      router.replace({
        pathname: '/(app)/invoices/[id]',
        params: { id: json.invoice.id },
      } as never);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
      footer={
        <Button
          title={saving ? 'Creating…' : 'Create invoice'}
          loading={saving}
          disabled={saving}
          onPress={() => void onSubmit()}
        />
      }
      header={
        <PageHeader
          title="New invoice"
          subtitle="Free · Powered by ORYNO"
          showBack
        />
      }>
      <View style={styles.stack}>
        <Field label="Customer name" colors={colors}>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer or business name"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
        </Field>

        <Field label="Customer email" colors={colors}>
          <TextInput
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Optional"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
        </Field>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Line items</Text>
          {items.map((item, idx) => (
            <View key={idx} style={styles.lineRow}>
              <TextInput
                value={item.description}
                onChangeText={(v) => {
                  const next = [...items];
                  next[idx] = { ...item, description: v };
                  setItems(next);
                }}
                placeholder="Description"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, styles.lineDesc]}
              />
              <TextInput
                value={item.quantity}
                onChangeText={(v) => {
                  const next = [...items];
                  next[idx] = { ...item, quantity: v };
                  setItems(next);
                }}
                placeholder="Qty"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, styles.lineQty]}
              />
              <TextInput
                value={item.unitPrice}
                onChangeText={(v) => {
                  const next = [...items];
                  next[idx] = { ...item, unitPrice: v };
                  setItems(next);
                }}
                placeholder={`Price (${currency})`}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, styles.linePrice]}
              />
            </View>
          ))}
          <Pressable
            onPress={() =>
              setItems((prev) => [
                ...prev,
                { description: '', quantity: '1', unitPrice: '' },
              ])
            }>
            <Text style={styles.addLine}>+ Add line</Text>
          </Pressable>
        </View>

        <Field label="Notes" colors={colors}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional message on the invoice"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, styles.notes]}
            multiline
          />
        </Field>
      </View>
    </Screen>
  );
}

function Field({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={stylesField.wrap}>
      <Text style={[stylesField.label, { color: colors.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

const stylesField = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700' },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stack: { gap: 16 },
    section: { gap: 10 },
    label: { fontSize: 13, fontWeight: '700' },
    input: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    lineRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    lineDesc: { flex: 1, minWidth: '100%' },
    lineQty: { width: 72 },
    linePrice: { flex: 1, minWidth: 100 },
    addLine: {
      fontSize: 14,
      fontWeight: '800',
      color: Brand.orange,
      marginTop: 4,
    },
    notes: { minHeight: 88, textAlignVertical: 'top' },
  });
}
