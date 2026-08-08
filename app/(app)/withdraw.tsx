import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { formatNaira } from '@/lib/format';
import type { BankAccountSummary } from '@/lib/types';

type BankOption = { name: string; code: string };

export default function WithdrawScreen() {
  const { colors } = useAppTheme();
  const invalidateWallet = useInvalidateWallet();
  const [amount, setAmount] = useState('');
  const [banks, setBanks] = useState<BankAccountSummary[]>([]);
  const [options, setOptions] = useState<BankOption[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api.get<{
        banks: BankAccountSummary[];
        options: BankOption[];
      }>('/api/wallet/banks');
      setBanks(json.banks ?? []);
      setOptions(json.options ?? []);
      const primary = json.banks?.find((b) => b.isPrimary) ?? json.banks?.[0];
      if (primary) setSelectedBankId(primary.id);
    } catch (e) {
      alert.error(
        'Could not load banks',
        e instanceof Error ? e.message : 'Failed to load banks',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async () => {
    if (!bankCode || accountNumber.length < 10) {
      alert.warning('Missing details', 'Enter bank code and a 10-digit account number.');
      return;
    }
    try {
      const json = await api.post<{
        ok: true;
        accountName: string;
        bankName: string;
      }>('/api/wallet/banks/resolve', { bankCode, accountNumber });
      setAccountName(json.accountName);
      alert.success('Account resolved', `${json.accountName} · ${json.bankName}`);
    } catch (e) {
      alert.error(
        'Resolve failed',
        e instanceof Error ? e.message : 'Could not resolve account',
      );
    }
  };

  const saveBank = async () => {
    const opt = options.find((o) => o.code === bankCode);
    try {
      const json = await api.post<{ ok: true; bank: BankAccountSummary }>('/api/wallet/banks', {
        bankCode,
        bankName: opt?.name,
        accountName,
        accountNumber,
        makePrimary: true,
      });
      setBanks((prev) => [json.bank, ...prev.filter((b) => b.id !== json.bank.id)]);
      setSelectedBankId(json.bank.id);
      alert.success('Bank saved', 'This account is ready for withdrawals.');
    } catch (e) {
      alert.error(
        'Could not save bank',
        e instanceof Error ? e.message : 'Could not save bank',
      );
    }
  };

  const withdraw = async () => {
    if (!selectedBankId || !amount) {
      alert.warning('Missing details', 'Select a bank and enter an amount.');
      return;
    }
    setLoading(true);
    try {
      const json = await api.post<{
        ok: true;
        message: string;
        amountFormatted: string;
        pending: boolean;
      }>('/api/wallet/withdraw', { amount: Number(amount), bankAccountId: selectedBankId });
      invalidateWallet();
      alert.success(
        'Withdrawal submitted',
        json.message || `${json.amountFormatted} processing`,
      );
    } catch (e) {
      alert.error(
        'Withdraw failed',
        e instanceof Error ? e.message : 'Request failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <PageHeader title="Withdraw" subtitle="Payout to your local bank" showBack />

      <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="5000" />

      <Text style={[styles.label, { color: colors.foreground }]}>Saved banks</Text>
      <View style={styles.list}>
        {banks.map((b) => {
          const active = selectedBankId === b.id;
          return (
            <Pressable
              key={b.id}
              onPress={() => setSelectedBankId(b.id)}
              style={[
                styles.bank,
                { backgroundColor: colors.muted },
                active && styles.bankActive,
              ]}>
              <Text style={[styles.bankName, { color: colors.foreground }]}>{b.bankName}</Text>
              <Text style={[styles.bankMeta, { color: colors.mutedForeground }]}>
                {b.accountName} · {b.maskedNumber || b.accountNumber}
              </Text>
            </Pressable>
          );
        })}
        {!banks.length ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            No saved banks yet — add one below
          </Text>
        ) : null}
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Add bank</Text>
      <View style={styles.chips}>
        {options.slice(0, 8).map((o) => (
          <Pressable
            key={o.code}
            onPress={() => setBankCode(o.code)}
            style={[
              styles.chip,
              { backgroundColor: colors.muted },
              bankCode === o.code && styles.chipActive,
            ]}>
            <Text
              style={[
                styles.chipText,
                { color: colors.foreground },
                bankCode === o.code && styles.chipTextActive,
              ]}
              numberOfLines={1}>
              {o.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextField label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" />
      {accountName ? <Text style={styles.resolved}>Account name: {accountName}</Text> : null}
      <View style={styles.rowBtns}>
        <Button title="Resolve" variant="secondary" onPress={resolve} style={{ flex: 1 }} />
        <Button title="Save bank" variant="secondary" onPress={saveBank} style={{ flex: 1 }} />
      </View>

      <Button
        title={`Withdraw ${amount ? formatNaira(amount) : ''}`}
        onPress={withdraw}
        loading={loading}
        style={{ marginTop: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 8, fontWeight: '700' },
  list: { gap: 8 },
  bank: {
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  bankActive: { borderColor: Brand.orange, backgroundColor: Brand.orangeMuted },
  bankName: { fontWeight: '700' },
  bankMeta: { fontSize: 12, marginTop: 2 },
  hint: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 99,
    maxWidth: '48%',
  },
  chipActive: { backgroundColor: Brand.orangeMuted },
  chipText: { fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: Brand.orange },
  resolved: { color: Brand.success, fontWeight: '600', marginBottom: 8 },
  rowBtns: { flexDirection: 'row', gap: 10 },
});
