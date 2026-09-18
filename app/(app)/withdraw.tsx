import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { cardEntering } from '@/lib/motion';

import { PageHeader } from '@/components/app/page-header';
import {
  TransactionPinModal,
  type TransactionPinModalMode,
} from '@/components/app/transaction-pin-modal';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useWallet } from '@/hooks/use-wallet';
import { ApiError, api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import type { WalletSummary } from '@/lib/types';

function currencySymbol(currency?: string | null) {
  if (currency === 'GHS') return 'GH₵';
  if (currency === 'KES') return 'KSh';
  if (currency === 'ZAR') return 'R';
  return '₦';
}

/** Withdraw — matches website `/withdraw`: amount, saved payout bank, PIN confirm. */
export default function WithdrawScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const invalidateWallet = useInvalidateWallet();
  const { data: walletPayload, loading: walletLoading, refresh } = useWallet();
  const { pulling, onRefresh } = usePullRefresh(refresh);

  /** Wallet returned by the withdraw response wins — it has the post-debit balance. */
  const [walletOverride, setWalletOverride] = useState<WalletSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinMode, setPinMode] = useState<TransactionPinModalMode>('confirm');
  const [pinError, setPinError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amountFormatted: string;
    reference?: string | null;
    bankName?: string;
    pending?: boolean;
  } | null>(null);

  const wallet = walletOverride ?? walletPayload?.primary ?? null;
  const banks = useMemo(() => walletPayload?.banks ?? [], [walletPayload?.banks]);
  const minWithdraw = walletPayload?.withdrawMinimum ?? null;
  const withdrawFee = walletPayload?.withdrawFee ?? null;
  const feeLocal = withdrawFee?.local ?? 0;
  const symbol = currencySymbol(wallet?.currency);

  const amountNumber = Number(amount);
  const amountValue = Number.isFinite(amountNumber) ? amountNumber : 0;
  const overBalance =
    wallet != null && amountValue + feeLocal > Number(wallet.balance) + 0.0001;
  const canSubmit =
    !submitting && Boolean(bankAccountId) && amountValue > 0 && banks.length > 0 && !overBalance;

  const localMoney = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  useEffect(() => {
    if (bankAccountId) return;
    const primary = banks.find((b) => b.isPrimary) ?? banks[0];
    if (primary) setBankAccountId(primary.id);
  }, [banks, bankAccountId]);

  useEffect(() => {
    if (!minWithdraw) return;
    setAmount((prev) => (prev ? prev : String(minWithdraw.minLocal)));
  }, [minWithdraw]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const json = await api.get<{ security?: { hasPin?: boolean } }>(
          endpoints.settings.root,
        );
        if (!cancelled) setHasPin(Boolean(json.security?.hasPin));
      } catch {
        // PIN status stays false until settings load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openPinModal() {
    setError(null);
    setPinError(null);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (minWithdraw && amountNumber + 1e-9 < minWithdraw.minLocal) {
      setError(minWithdraw.message);
      return;
    }
    if (overBalance) {
      setError(
        withdrawFee
          ? `Amount plus ${withdrawFee.formatted} fee exceeds your available balance.`
          : 'Insufficient wallet balance.',
      );
      return;
    }
    setPinMode(hasPin ? 'confirm' : 'create');
    setPinModalOpen(true);
  }

  async function submitWithdraw(payload: { pin: string; isCreate: boolean }) {
    setSubmitting(true);
    setError(null);
    setPinError(null);
    try {
      const json = await api.post<{
        amountFormatted?: string;
        reference?: string | null;
        pending?: boolean;
        transactionId?: string;
        wallet?: WalletSummary;
        bank?: { bankName: string };
      }>(endpoints.wallet.withdraw, {
        amount: amountNumber,
        bankAccountId,
        pin: payload.pin,
        ...(payload.isCreate ? { newPin: payload.pin } : {}),
      });

      if (payload.isCreate) setHasPin(true);
      setPinModalOpen(false);
      if (json.wallet) setWalletOverride(json.wallet);
      invalidateWallet();

      if (json.transactionId) {
        router.replace(`/(app)/history/${json.transactionId}`);
        return;
      }

      setSuccess({
        amountFormatted: json.amountFormatted ?? localMoney(amountValue),
        reference: json.reference,
        bankName: json.bank?.bankName,
        pending: Boolean(json.pending),
      });
    } catch (e) {
      if (e instanceof ApiError) {
        const body = (e.body ?? {}) as {
          error?: string;
          code?: string;
          hasPin?: boolean;
        };
        const code = typeof body.code === 'string' ? body.code : '';
        if (code.startsWith('pin_') || body.hasPin === false || e.status === 423) {
          if (typeof body.hasPin === 'boolean') setHasPin(body.hasPin);
          setPinError(body.error || e.message || 'PIN verification failed');
          return;
        }
        setPinModalOpen(false);
        setError(body.error || e.message || 'Withdrawal unavailable');
        return;
      }
      setPinModalOpen(false);
      setError(e instanceof Error ? e.message : 'Withdrawal unavailable');
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <PageHeader title="Withdraw" subtitle="Send funds to your bank" showBack />
  );

  if (walletLoading) {
    return (
      <Screen scroll header={header}>
        <View style={styles.card}>
          <Skeleton width={110} height={14} radius={999} />
          <Skeleton width="100%" height={48} radius={14} style={{ marginTop: 12 }} />
          <Skeleton width={130} height={14} radius={999} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={96} radius={16} style={{ marginTop: 12 }} />
        </View>
      </Screen>
    );
  }

  if (success) {
    return (
      <Screen scroll header={header}>
        <Animated.View entering={cardEntering(0)} style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons
              name={success.pending ? 'time' : 'checkmark-circle'}
              size={34}
              color={Brand.orange}
            />
          </View>
          <Text style={styles.successTitle}>
            {success.pending ? 'Withdrawal processing' : 'Withdrawal sent'}
          </Text>
          <Text style={styles.successSub}>
            {success.amountFormatted}
            {success.bankName ? ` → ${success.bankName}` : ''}
          </Text>
          {success.reference ? (
            <Text style={styles.successRef}>Ref · {success.reference}</Text>
          ) : null}
          {success.pending ? (
            <Text style={styles.successNote}>
              Your transfer is on the way. You’ll get a notification when it lands.
            </Text>
          ) : null}
          {wallet ? (
            <Text style={styles.successBalance}>Remaining · {wallet.balanceFormatted}</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.successBtn,
              pressed && { opacity: 0.92 },
            ]}
            onPress={() => router.replace('/(app)/(tabs)/wallet')}>
            <Text style={styles.primaryBtnText}>Back to wallet</Text>
          </Pressable>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshing={pulling}
      onRefresh={onRefresh}
      header={header}
      footer={
        <Pressable
          disabled={!canSubmit}
          onPress={openPinModal}
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.footerBtn,
            !canSubmit && styles.primaryBtnDisabled,
            pressed && canSubmit && { opacity: 0.92 },
          ]}>
          {submitting ? (
            <View style={styles.footerBtnRow}>
              <ActivityIndicator color={Brand.white} size="small" />
              <Text style={styles.primaryBtnText}>Sending…</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>
              {overBalance ? 'Insufficient balance' : 'Withdraw Funds'}
            </Text>
          )}
        </Pressable>
      }>
      {wallet ? (
        <Animated.View entering={cardEntering(0)} style={styles.balanceBanner}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Text style={styles.balanceValue}>{wallet.balanceFormatted}</Text>
        </Animated.View>
      ) : null}

      <Animated.View entering={cardEntering(40)} style={styles.card}>
        <Text style={styles.fieldLabel}>Amount ({symbol})</Text>
        <View style={styles.amountWrap}>
          <Text style={styles.currencyPrefix}>{symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v.replace(/[^\d.]/g, ''));
              setError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            style={styles.amountInput}
          />
        </View>
        {minWithdraw ? (
          <Text style={styles.hint}>Minimum withdrawal · {minWithdraw.formatted}</Text>
        ) : null}

        {withdrawFee && withdrawFee.ngn > 0 ? (
          <View style={styles.feeCard}>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>You receive</Text>
              <Text style={styles.feeValue}>{localMoney(amountValue)}</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Withdrawal fee</Text>
              <Text style={styles.feeValue}>
                {withdrawFee.formatted}
                {withdrawFee.currency !== 'NGN' ? ` (${withdrawFee.formattedNgn})` : ''}
              </Text>
            </View>
            <View style={[styles.feeRow, styles.feeTotalRow]}>
              <Text style={styles.feeTotalLabel}>Total deducted</Text>
              <Text style={styles.feeTotalValue}>{localMoney(amountValue + feeLocal)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.bankHead}>
          <Text style={[styles.fieldLabel, styles.bankHeadLabel]}>Bank Account</Text>
          <Pressable
            onPress={() => router.push('/(app)/wallet/add-bank')}
            hitSlop={8}
            style={styles.manageLink}>
            <Ionicons name="add" size={14} color={Brand.orange} />
            <Text style={styles.manageText}>Manage</Text>
          </Pressable>
        </View>

        {banks.length === 0 ? (
          <View style={styles.emptyBanks}>
            <Text style={styles.emptyTitle}>No bank account saved</Text>
            <Text style={styles.emptySub}>
              Add a verified payout account before withdrawing.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.92 }]}
              onPress={() => router.push('/(app)/wallet/add-bank')}>
              <Text style={styles.primaryBtnText}>Add bank</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bankList}>
            {banks.map((bank) => {
              const selected = bankAccountId === bank.id;
              return (
                <Pressable
                  key={bank.id}
                  onPress={() => {
                    setBankAccountId(bank.id);
                    setError(null);
                  }}
                  style={[styles.bankRow, selected && styles.bankRowActive]}>
                  <View style={styles.bankIcon}>
                    <MaterialIcons name="account-balance" size={18} color={Brand.orange} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.bankName} numberOfLines={1}>
                      {bank.bankName}
                      {bank.isPrimary ? ' · Primary' : ''}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1}>
                      {bank.accountName} · {bank.maskedNumber || bank.accountNumber}
                    </Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioActive]} />
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TransactionPinModal
        visible={pinModalOpen}
        mode={pinMode}
        loading={submitting}
        error={pinError}
        confirmLabel={pinMode === 'create' ? 'Set PIN & withdraw' : 'Confirm withdrawal'}
        onClose={() => {
          if (!submitting) {
            setPinModalOpen(false);
            setPinError(null);
          }
        }}
        onConfirm={(payload) => void submitWithdraw(payload)}
      />
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    balanceBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    balanceLabel: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
    balanceValue: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    card: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
    },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    amountWrap: {
      marginTop: 8,
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    currencyPrefix: { fontSize: 20, fontWeight: '800', color: colors.mutedForeground },
    amountInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    hint: { marginTop: 8, fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
    feeCard: {
      marginTop: 16,
      gap: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    feeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    feeLabel: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
    feeValue: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    feeTotalRow: {
      marginTop: 2,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    feeTotalLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    feeTotalValue: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    bankHead: {
      marginTop: 18,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    bankHeadLabel: { flex: 1 },
    manageLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    manageText: { fontSize: 12, fontWeight: '700', color: Brand.orange },
    emptyBanks: {
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    emptySub: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 18,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    emptyBtn: {
      marginTop: 16,
      height: 40,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    bankList: { gap: 10 },
    bankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    bankRowActive: { borderColor: Brand.orange, backgroundColor: colors.orangeMuted },
    bankIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bankName: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    bankMeta: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.border,
    },
    radioActive: { borderColor: Brand.orange, backgroundColor: Brand.orange },
    errorText: {
      marginTop: 14,
      fontSize: 13,
      fontWeight: '600',
      color: Brand.error,
    },
    primaryBtn: {
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
    footerBtn: { height: 46 },
    footerBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    successCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 24,
      paddingVertical: 40,
      alignItems: 'center',
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      marginTop: 16,
      fontSize: 20,
      fontWeight: '800',
      color: colors.foreground,
      textAlign: 'center',
    },
    successSub: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    successRef: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    successNote: {
      marginTop: 12,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 18,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    successBalance: {
      marginTop: 16,
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    successBtn: { marginTop: 24, alignSelf: 'stretch' },
  });
}
