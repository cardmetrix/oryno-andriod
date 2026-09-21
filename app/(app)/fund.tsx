import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useWallet, fetchWallet } from '@/hooks/use-wallet';
import { alert } from '@/lib/alert';
import { ApiError, api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import type { DepositAccount } from '@/lib/types';

type IdentityRequired = {
  required: true;
  idTypes: Array<'BVN' | 'NIN'>;
  message: string;
  kycStatus: string;
  kycLevel: number;
  hasPendingKyc: boolean;
};

/**
 * Fund wallet — matches website `/fund`:
 * dedicated Flutterwave deposit account, BVN/NIN gate, reconcile check.
 */
export default function FundScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const invalidateWallet = useInvalidateWallet();
  const { data: walletPayload, refresh: refreshWallet } = useWallet();

  const [deposit, setDeposit] = useState<DepositAccount | null>(null);
  const [identityRequired, setIdentityRequired] = useState<IdentityRequired | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submittingIdentity, setSubmittingIdentity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [copied, setCopied] = useState<'number' | 'name' | null>(null);
  const [idType, setIdType] = useState<'BVN' | 'NIN'>('BVN');
  const [idNumber, setIdNumber] = useState('');
  const lastBalanceRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  const wallet = walletPayload?.primary ?? null;

  const goToLatestFundReceipt = useCallback(async () => {
    if (redirectedRef.current) return;
    try {
      const json = await fetchWallet();
      const latest =
        json.recent?.find(
          (tx) => tx.type === 'credit' && (!tx.category || tx.category === 'fund'),
        ) ?? json.recent?.find((tx) => tx.type === 'credit');
      if (latest?.id) {
        redirectedRef.current = true;
        router.replace(`/(app)/history/${latest.id}`);
      }
    } catch {
      // stay on fund screen
    }
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const prev = lastBalanceRef.current;
    if (
      prev != null &&
      wallet.balance !== prev &&
      Number(wallet.balance) > Number(prev)
    ) {
      alert.success('Payment received', `Your wallet is now ${wallet.balanceFormatted}`);
      void goToLatestFundReceipt();
    }
    lastBalanceRef.current = wallet.balance;
  }, [wallet, goToLatestFundReceipt]);

  // Soft-poll wallet while the fund screen is open (website uses 8s interval).
  useEffect(() => {
    const id = setInterval(() => {
      void refreshWallet();
    }, 8000);
    return () => clearInterval(id);
  }, [refreshWallet]);

  /** `silent` keeps the loaded card on screen for refresh instead of flashing skeletons. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    setSetupHint(null);
    try {
      const json = await api.get<{
        account?: DepositAccount | null;
        identityRequired?: IdentityRequired | null;
        error?: string;
        setupHint?: string | null;
      }>(endpoints.wallet.depositAccount);

      setDeposit(json.account ?? null);
      setIdentityRequired(json.identityRequired ?? null);
      setSetupHint(json.setupHint ?? null);
      if (!json.account && !json.identityRequired) {
        setError(json.error || 'Could not load your dedicated account. Try refresh.');
      }
    } catch (e) {
      // Website returns identityRequired on some non-2xx responses — keep that UX.
      if (e instanceof ApiError && e.body && typeof e.body === 'object') {
        const body = e.body as {
          account?: DepositAccount | null;
          identityRequired?: IdentityRequired | null;
          error?: string;
          setupHint?: string | null;
        };
        setDeposit(body.account ?? null);
        setIdentityRequired(body.identityRequired ?? null);
        setSetupHint(body.setupHint ?? null);
        if (body.identityRequired) {
          setError(null);
          return;
        }
        setError(body.error || e.message);
        return;
      }
      setDeposit(null);
      setIdentityRequired(null);
      setError(e instanceof Error ? e.message : 'Could not load your dedicated account');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(true), refreshWallet()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshWallet]);

  async function copyValue(kind: 'number' | 'name', value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  async function onIHaveFunded() {
    setChecking(true);
    setError(null);
    alert.info(
      'Checking for your transfer',
      'We’re matching your bank payment with Flutterwave. This can take a few minutes.',
    );
    try {
      const json = await api.post<{
        credited?: number;
        message?: string;
        error?: string;
      }>(endpoints.wallet.depositReconcile, {});

      if ((json.credited ?? 0) > 0) {
        alert.success('Deposit received', json.message || 'Your wallet was credited.');
        invalidateWallet();
        await refreshWallet();
        void goToLatestFundReceipt();
      } else {
        alert.info(
          json.message || 'No new deposit yet',
          'If you just transferred, wait a few minutes and try again.',
        );
        await refreshWallet();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not check for your deposit';
      setError(msg);
    } finally {
      setChecking(false);
    }
  }

  async function onSubmitIdentity() {
    const digits = idNumber.replace(/\D/g, '');
    if (digits.length !== 11) {
      setError(`${idType} must be exactly 11 digits.`);
      return;
    }

    setSubmittingIdentity(true);
    setError(null);
    try {
      const json = await api.post<{
        account?: DepositAccount | null;
        identityRequired?: IdentityRequired | null;
        error?: string;
      }>(endpoints.wallet.depositAccount, { idType, idNumber: digits });

      if (json.account) {
        setDeposit(json.account);
        setIdentityRequired(null);
        setIdNumber('');
        alert.success('Account ready', 'Your fund account is ready.');
        return;
      }

      setIdentityRequired(json.identityRequired ?? null);
      setError(json.error || 'Could not create your fund account. Try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your details. Try again.');
    } finally {
      setSubmittingIdentity(false);
    }
  }

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      header={
        <PageHeader
          title="Fund Wallet"
          subtitle="Transfer to your dedicated account"
          showBack
        />
      }>
      {wallet ? (
        <Animated.View entering={cardEntering(0)} style={styles.balanceBanner}>
          <Text style={styles.balanceLabel}>Current balance</Text>
          <Text style={styles.balanceValue}>{wallet.balanceFormatted}</Text>
        </Animated.View>
      ) : null}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Fund Wallet"
      />

      {loading ? (
        <View style={styles.card}>
          <Skeleton width="40%" height={14} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={140} radius={18} />
        </View>
      ) : identityRequired ? (
        <Animated.View entering={cardEntering(0).delay(40)} style={styles.card}>
          <View style={styles.identityHead}>
            <View style={styles.identityIcon}>
              <Ionicons name="shield-checkmark" size={22} color={Brand.orange} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.identityTitle}>Verify to get your account number</Text>
              <Text style={styles.identitySub}>{identityRequired.message}</Text>
            </View>
          </View>

          <View style={styles.segRow}>
            {identityRequired.idTypes.map((type) => (
              <Pressable
                key={type}
                onPress={() => {
                  setIdType(type);
                  setError(null);
                }}
                style={[styles.seg, idType === type && styles.segActive]}>
                <Text style={[styles.segText, idType === type && styles.segTextActive]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            {idType === 'BVN' ? 'Bank Verification Number' : 'National ID Number'}
          </Text>
          <TextInput
            value={idNumber}
            onChangeText={(v) => {
              setIdNumber(v.replace(/\D/g, '').slice(0, 11));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={11}
            placeholder={`11-digit ${idType}`}
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          <Text style={styles.hint}>
            We use your {idType} only to create your personal fund account. It must match your
            name on ORYNO.
          </Text>

          <Pressable
            style={[
              styles.primaryBtn,
              (submittingIdentity || idNumber.length !== 11) && { opacity: 0.5 },
            ]}
            disabled={submittingIdentity || idNumber.length !== 11}
            onPress={() => void onSubmitIdentity()}>
            {submittingIdentity ? (
              <ActivityIndicator color={Brand.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Get my account number</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.kycLink}
            onPress={() => router.push('/(app)/settings/kyc')}>
            <Text style={styles.kycLinkText}>Already started verification? View KYC status</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={cardEntering(0).delay(40)} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>Bank details</Text>
            <Pressable
              style={styles.refreshBtn}
              onPress={() => {
                void load(true);
                void refreshWallet();
              }}>
              <Ionicons name="refresh" size={14} color={Brand.orange} />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {deposit ? (
            <View style={styles.detailsBox}>
              <DetailRow label="Bank" value={deposit.bankName} colors={colors} styles={styles} />
              <DetailRow
                label="Account name"
                value={deposit.accountName}
                colors={colors}
                styles={styles}
                onCopy={() => void copyValue('name', deposit.accountName)}
                copied={copied === 'name'}
              />
              <DetailRow
                label="Account number"
                value={deposit.accountNumber}
                colors={colors}
                styles={styles}
                mono
                emphasize
                onCopy={() => void copyValue('number', deposit.accountNumber)}
                copied={copied === 'number'}
              />
              {deposit.instructions ? (
                <Text style={styles.instructions}>{deposit.instructions}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="account-balance" size={28} color={Brand.orange} />
              <Text style={styles.emptyTitle}>Deposit account unavailable</Text>
              <Text style={styles.emptySub}>
                Try refresh, or complete identity verification.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => void load()}>
                <Text style={styles.primaryBtnText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      )}

      {deposit && !identityRequired ? (
        <Animated.View entering={cardEntering(0).delay(100)}>
          <Pressable
            style={[styles.primaryBtn, styles.checkBtn, checking && { opacity: 0.7 }]}
            disabled={checking}
            onPress={() => void onIHaveFunded()}>
            {checking ? (
              <ActivityIndicator color={Brand.white} />
            ) : (
              <Text style={styles.primaryBtnText}>I’ve funded — check balance</Text>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {setupHint ? <Text style={styles.setupHint}>{setupHint}</Text> : null}
    </Screen>
  );
}

function DetailRow({
  label,
  value,
  mono,
  emphasize,
  onCopy,
  copied,
  colors,
  styles,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[
            styles.detailValue,
            mono && styles.detailMono,
            emphasize && styles.detailEmphasize,
            { color: emphasize ? Brand.orange : colors.foreground },
          ]}
          selectable>
          {value}
        </Text>
      </View>
      {onCopy ? (
        <Pressable style={styles.copyPill} onPress={onCopy}>
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={14}
            color={copied ? Brand.success : colors.foreground}
          />
          <Text style={[styles.copyPillText, copied && { color: Brand.success }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    balanceBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    balanceLabel: { fontSize: 13, color: colors.mutedForeground, fontWeight: '500' },
    balanceValue: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    card: {
      borderRadius: Radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    refreshText: { fontSize: 12, fontWeight: '700', color: Brand.orange },
    detailsBox: {
      borderRadius: 18,
      backgroundColor: colors.muted,
      padding: 14,
      gap: 14,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '700',
    },
    detailMono: { fontVariant: ['tabular-nums'], letterSpacing: 0.4 },
    detailEmphasize: { fontSize: 18, fontWeight: '800' },
    copyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    copyPillText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    instructions: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    identityHead: { flexDirection: 'row', gap: 12, marginBottom: 14 },
    identityIcon: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identityTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    identitySub: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      color: colors.mutedForeground,
    },
    segRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    seg: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: colors.muted,
    },
    segActive: { backgroundColor: Brand.orange },
    segText: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
    segTextActive: { color: Brand.white },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 8,
    },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
    },
    hint: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 17,
      color: colors.mutedForeground,
    },
    primaryBtn: {
      marginTop: 16,
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkBtn: { marginTop: 14 },
    primaryBtnText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
    kycLink: { marginTop: 14, alignItems: 'center' },
    kycLinkText: {
      fontSize: 12,
      fontWeight: '600',
      color: Brand.orange,
      textAlign: 'center',
    },
    emptyCard: { alignItems: 'center', paddingVertical: 12, gap: 6 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    emptySub: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginBottom: 4,
    },
    setupHint: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 17,
      color: colors.mutedForeground,
    },
  });
}
