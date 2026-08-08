import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { formatNaira } from '@/lib/format';
import type { DepositAccount } from '@/lib/types';

const presets = ['1000', '2000', '5000', '10000', '20000', '50000'];

export default function FundScreen() {
  const { colors } = useAppTheme();
  const invalidateWallet = useInvalidateWallet();
  const [amount, setAmount] = useState('5000');
  const [account, setAccount] = useState<DepositAccount | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.get<{ account: DepositAccount; demoMode: boolean }>(
        '/api/wallet/deposit-account',
      );
      setAccount(json.account);
      setDemoMode(json.demoMode);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const createAccount = async () => {
    setCreating(true);
    try {
      const json = await api.post<{ ok: true; account: DepositAccount; demoMode: boolean }>(
        '/api/wallet/deposit-account',
        {},
      );
      setAccount(json.account);
      setDemoMode(json.demoMode);
      alert.success(
        'Account ready',
        'Transfer to the virtual account below to fund your wallet.',
      );
    } catch (e) {
      alert.error(
        'Could not create account',
        e instanceof Error ? e.message : 'Could not create deposit account',
      );
    } finally {
      setCreating(false);
    }
  };

  const simulate = async () => {
    try {
      const json = await api.post<{ ok: true; message: string; amountFormatted?: string }>(
        '/api/wallet/fund/simulate',
        { amount: Number(amount) },
      );
      invalidateWallet();
      alert.success(
        'Funded',
        json.message || `Credited ${json.amountFormatted ?? formatNaira(amount)}`,
      );
    } catch (e) {
      alert.warning(
        'Simulate unavailable',
        e instanceof Error ? e.message : 'Only works in Paystack demo mode',
      );
    }
  };

  return (
    <Screen scroll>
      <PageHeader title="Fund Wallet" subtitle="Paystack dedicated virtual account" showBack />

      <Text style={[styles.label, { color: colors.foreground }]}>
        Amount (for simulate / reference)
      </Text>
      <View style={styles.presets}>
        {presets.map((p) => {
          const active = amount === p;
          return (
            <Pressable
              key={p}
              onPress={() => setAmount(p)}
              style={[
                styles.chip,
                { backgroundColor: colors.muted },
                active && styles.chipActive,
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: colors.foreground },
                  active && styles.chipTextActive,
                ]}>
                {formatNaira(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField label="Custom amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />

      {loading && !account ? (
        <FormSkeleton />
      ) : !account ? (
        <Button title="Generate virtual account" onPress={createAccount} loading={creating} />
      ) : (
        <View style={[styles.dva, { backgroundColor: colors.muted }]}>
          <Text style={[styles.dvaTitle, { color: colors.foreground }]}>{account.bankName}</Text>
          <Text style={[styles.dvaMeta, { color: colors.mutedForeground }]}>
            {account.accountName}
          </Text>
          <Pressable
            onPress={() =>
              alert.info('Account number', account.accountNumber)
            }>
            <Text style={styles.acct}>{account.accountNumber}</Text>
          </Pressable>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {account.instructions}
          </Text>
          {demoMode ? <Text style={styles.demo}>Demo mode · simulate deposits below</Text> : null}
        </View>
      )}

      {demoMode ? (
        <Button title="Simulate deposit" variant="secondary" onPress={simulate} style={{ marginTop: 12 }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 99,
  },
  chipActive: { backgroundColor: Brand.orangeMuted, borderWidth: 1.5, borderColor: Brand.orange },
  chipText: { fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: Brand.orange },
  dva: {
    marginTop: 18,
    padding: 18,
    borderRadius: Radius.xl,
    gap: 6,
  },
  dvaTitle: { fontSize: 16, fontWeight: '800' },
  dvaMeta: { fontSize: 13 },
  acct: { fontSize: 28, fontWeight: '800', color: Brand.orange, marginVertical: 8 },
  hint: { fontSize: 12, lineHeight: 18 },
  demo: { marginTop: 8, color: Brand.orange, fontWeight: '600', fontSize: 12 },
});
