import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useProfile } from '@/hooks/use-profile';
import { api } from '@/lib/api';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

export default function NewPaymentLinkScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode } = useProfile();
  const currency = getCountryInfo(countryCode).currency;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    if (!title.trim() || !amount.trim()) {
      toast.error('Title and amount are required');
      return;
    }
    setSaving(true);
    try {
      const json = await api.post<{ url?: string; error?: string }>(
        endpoints.paymentLinks.list,
        {
          title,
          amount: Number(amount),
          currency,
          customerName,
          customerEmail,
          note,
        },
      );
      if (json.url) await Clipboard.setStringAsync(json.url);
      toast.success('Payment link created and copied');
      router.replace('/(app)/payment-links' as never);
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
          title="New payment link"
          subtitle="Standalone checkout - separate from invoices"
          showBack
        />
      }>
      <View style={styles.stack}>
        <Field styles={styles} label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Website deposit"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
        </Field>
        <Field styles={styles} label={`Amount (${currency})`}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
        </Field>
        <Field styles={styles} label="Customer name (optional)">
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
        </Field>
        <Field styles={styles} label="Customer email (optional)">
          <TextInput
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
        </Field>
        <Field styles={styles} label="Note (optional)">
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, styles.note]}
          />
        </Field>
        <Pressable
          disabled={saving}
          onPress={() => void onSubmit()}
          style={[styles.submit, saving && styles.disabled]}>
          <Text style={styles.submitText}>{saving ? 'Creating...' : 'Create link'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Field({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stack: { gap: 16 },
    field: { gap: 6 },
    label: { fontSize: 14, fontWeight: '600', color: colors.foreground },
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
    note: { minHeight: 88, textAlignVertical: 'top' },
    submit: {
      height: 44,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
    disabled: { opacity: 0.5 },
  });
}
