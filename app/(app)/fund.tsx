import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatNaira } from '@/lib/format';
import type { DepositAccount } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const PRESETS = ['1000', '2000', '5000', '10000', '20000', '50000'];

/**
 * Fund wallet bottom sheet — dedicated virtual account + optional demo simulate.
 */
export default function FundSheet() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const invalidateWallet = useInvalidateWallet();

  const [amount, setAmount] = useState('5000');
  const [account, setAccount] = useState<DepositAccount | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'number' | 'name' | null>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<{ account?: DepositAccount; demoMode?: boolean }>(
        endpoints.wallet.depositAccount,
      );
      setAccount(json.account ?? null);
      setDemoMode(Boolean(json.demoMode));
    } catch (e) {
      setAccount(null);
      setError(e instanceof Error ? e.message : 'Could not load deposit account');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function createAccount() {
    setCreating(true);
    setError(null);
    try {
      const json = await api.post<{ account: DepositAccount; demoMode?: boolean }>(
        endpoints.wallet.depositAccount,
        {},
      );
      setAccount(json.account);
      setDemoMode(Boolean(json.demoMode));
      alert.success(
        'Account ready',
        'Transfer to the virtual account below to fund your wallet.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create deposit account');
    } finally {
      setCreating(false);
    }
  }

  async function copyValue(kind: 'number' | 'name', value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  async function simulate() {
    const n = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid amount to simulate');
      return;
    }
    setSimulating(true);
    setError(null);
    try {
      const json = await api.post<{ message?: string; amountFormatted?: string }>(
        endpoints.wallet.fundSimulate,
        { amount: n },
      );
      invalidateWallet();
      alert.success(
        'Funded',
        json.message || `Credited ${json.amountFormatted ?? formatNaira(n)}`,
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulate only works in Paystack demo mode');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <View style={styles.sheet}>
      {Platform.OS === 'android' ? (
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
      ) : (
        <View style={styles.handleSpacer} />
      )}

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Fund wallet</Text>
          <Text style={styles.subtitle}>Transfer to your Paystack virtual account</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
          accessibilityLabel="Close"
          hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !account ? (
          <View style={styles.dvaCard}>
            <View style={styles.dvaHead}>
              <Skeleton width={40} height={40} radius={14} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
            <Skeleton width={88} height={10} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={48} radius={14} style={{ marginBottom: 12 }} />
            <Skeleton width={72} height={10} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={44} radius={14} style={{ marginBottom: 12 }} />
            <Skeleton width="90%" height={11} />
            <Skeleton width="70%" height={11} style={{ marginTop: 6 }} />
          </View>
        ) : !account ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="account-balance" size={28} color={Brand.orange} />
            </View>
            <Text style={styles.emptyTitle}>No virtual account yet</Text>
            <Text style={styles.emptySub}>
              Generate a dedicated account number to receive Naira deposits into your wallet.
            </Text>
            <Pressable
              style={[styles.primaryBtn, creating && { opacity: 0.7 }]}
              disabled={creating}
              onPress={() => void createAccount()}>
              {creating ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Generate virtual account</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.dvaCard}>
            <View style={styles.dvaHead}>
              <View style={styles.dvaBankIcon}>
                <MaterialIcons name="account-balance" size={20} color={Brand.orange} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.dvaBank} numberOfLines={1}>
                  {account.bankName}
                </Text>
                <Text style={styles.dvaLabel}>Dedicated virtual account</Text>
              </View>
              {demoMode ? (
                <View style={styles.demoPill}>
                  <Text style={styles.demoPillText}>Demo</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.copyLabel}>Account number</Text>
            <Pressable
              style={styles.copyRow}
              onPress={() => void copyValue('number', account.accountNumber)}
              accessibilityLabel="Copy account number">
              <Text style={styles.acctNumber}>{account.accountNumber}</Text>
              <View style={styles.copyBtn}>
                <Ionicons
                  name={copied === 'number' ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied === 'number' ? Brand.success : Brand.orange}
                />
                <Text
                  style={[
                    styles.copyBtnText,
                    copied === 'number' && { color: Brand.success },
                  ]}>
                  {copied === 'number' ? 'Copied' : 'Copy'}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.copyLabel}>Account name</Text>
            <Pressable
              style={styles.copyRowMuted}
              onPress={() => void copyValue('name', account.accountName)}
              accessibilityLabel="Copy account name">
              <Text style={styles.acctName} numberOfLines={2}>
                {account.accountName}
              </Text>
              <Ionicons
                name={copied === 'name' ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={copied === 'name' ? Brand.success : colors.mutedForeground}
              />
            </Pressable>

            {account.instructions ? (
              <Text style={styles.instructions}>{account.instructions}</Text>
            ) : null}
          </View>
        )}

        {demoMode ? (
          <View style={styles.simulateBlock}>
            <Text style={styles.fieldLabel}>Simulate deposit (demo)</Text>
            <View style={styles.presets}>
              {PRESETS.map((p) => {
                const active = amount === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setAmount(p)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {formatNaira(p)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.amountWrap}>
              <Text style={styles.currencyPrefix}>₦</Text>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                style={styles.amountInput}
              />
            </View>
            <Pressable
              style={[styles.secondaryBtn, simulating && { opacity: 0.7 }]}
              disabled={simulating}
              onPress={() => void simulate()}>
              {simulating ? (
                <ActivityIndicator color={Brand.orange} />
              ) : (
                <Text style={styles.secondaryBtnText}>
                  Simulate {amount ? formatNaira(amount) : 'deposit'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {account ? (
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: colors.card,
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    handleSpacer: { height: 10 },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    subtitle: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    errorBox: {
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: 'rgba(255,59,48,0.08)',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { color: Brand.error, fontSize: 13, fontWeight: '600' },
    emptyCard: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      padding: 16,
      alignItems: 'center',
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    emptySub: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    primaryBtn: {
      marginTop: 14,
      alignSelf: 'stretch',
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
    dvaCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      padding: 14,
    },
    dvaHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    dvaBankIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dvaBank: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    dvaLabel: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    demoPill: {
      borderRadius: 999,
      backgroundColor: Brand.orangeMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    demoPillText: { fontSize: 11, fontWeight: '800', color: Brand.orange },
    copyLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 6,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 12,
    },
    acctNumber: {
      flex: 1,
      fontSize: 24,
      fontWeight: '800',
      color: Brand.orange,
      letterSpacing: 0.6,
      fontVariant: ['tabular-nums'],
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      backgroundColor: Brand.orangeMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    copyBtnText: { fontSize: 12, fontWeight: '800', color: Brand.orange },
    copyRowMuted: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 12,
    },
    acctName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.foreground,
    },
    instructions: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    simulateBlock: { marginTop: 14 },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 8,
    },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.muted,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: Brand.orangeMuted,
      borderColor: Brand.orange,
    },
    chipText: { fontWeight: '700', fontSize: 12, color: colors.foreground },
    chipTextActive: { color: Brand.orange },
    amountWrap: {
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    currencyPrefix: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.mutedForeground,
    },
    amountInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
      color: colors.foreground,
    },
    secondaryBtn: {
      height: 46,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { color: Brand.orange, fontWeight: '800', fontSize: 14 },
    doneBtn: {
      marginTop: 14,
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
  });
}
