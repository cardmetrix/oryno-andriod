import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
import { ApiError, api, publicProviderMessage } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';
import type { DepositAccount } from '@/lib/types';

type IdentityRequired = {
  required: true;
  idTypes: Array<'BVN' | 'NIN'>;
  message: string;
  kycStatus: string;
  kycLevel: number;
  hasPendingKyc: boolean;
};

type FundOptions = {
  method?: 'dva' | 'checkout';
  checkoutAvailable?: boolean;
  dvaAvailable?: boolean;
  countryCode?: string;
  currency?: string;
  presets?: string[];
  paymentOptions?: string;
  account?: DepositAccount | null;
  identityRequired?: IdentityRequired | null;
  error?: string;
  setupHint?: string | null;
  demoMode?: boolean;
};

const PAYMENT_OPTION_LABELS: Record<string, string> = {
  card: 'Card',
  banktransfer: 'Bank transfer',
  ussd: 'USSD',
  account: 'Account',
  mobilemoneyghana: 'Mobile money',
  mpesa: 'M-Pesa',
  mobilemoneyeastafrica: 'Mobile money',
};

function formatPaymentOptions(raw?: string | null) {
  if (!raw) return 'Card';
  return raw
    .split(',')
    .map((p) => PAYMENT_OPTION_LABELS[p.trim()] ?? p.trim())
    .filter(Boolean)
    .join(' · ');
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Fund wallet — matches website `/fund`:
 * DVA for NG/GH, card/checkout deposit for countries without account numbers.
 */
export default function FundScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const invalidateWallet = useInvalidateWallet();
  const { data: walletPayload, refresh: refreshWallet } = useWallet();

  const [deposit, setDeposit] = useState<DepositAccount | null>(null);
  const [identityRequired, setIdentityRequired] = useState<IdentityRequired | null>(
    null,
  );
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [preferCheckout, setPreferCheckout] = useState(false);
  const [currency, setCurrency] = useState('NGN');
  const [presets, setPresets] = useState<string[]>(['1000', '2000', '5000', '10000']);
  const [paymentOptions, setPaymentOptions] = useState('card');
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
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
    setCurrency(wallet.currency);
  }, [wallet, goToLatestFundReceipt]);

  useEffect(() => {
    const id = setInterval(() => {
      void refreshWallet();
    }, 8000);
    return () => clearInterval(id);
  }, [refreshWallet]);

  const applyOptions = useCallback((json: FundOptions) => {
    setDeposit(json.account ?? null);
    setIdentityRequired(json.identityRequired ?? null);
    const hint = json.setupHint?.trim() || null;
    setSetupHint(
      hint && publicProviderMessage(hint) === 'Service unavailable' ? null : hint,
    );
    setCheckoutAvailable(Boolean(json.checkoutAvailable));
    if (json.currency) setCurrency(json.currency);
    if (json.presets?.length) {
      setPresets(json.presets);
      setAmount((prev) => prev || json.presets![0]);
    }
    if (json.paymentOptions) setPaymentOptions(json.paymentOptions);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      setSetupHint(null);
      try {
        const json = await api.get<FundOptions>(endpoints.wallet.depositAccount);
        applyOptions(json);
        const hasPath =
          Boolean(json.account) ||
          Boolean(json.identityRequired) ||
          Boolean(json.checkoutAvailable);
        if (!hasPath && json.error) {
          setError(publicProviderMessage(json.error));
        }
      } catch (e) {
        if (e instanceof ApiError && e.body && typeof e.body === 'object') {
          const body = e.body as FundOptions;
          applyOptions(body);
          const hasPath =
            Boolean(body.account) ||
            Boolean(body.identityRequired) ||
            Boolean(body.checkoutAvailable);
          if (hasPath) {
            setError(null);
            return;
          }
          setError(publicProviderMessage(body.error || e.message));
          return;
        }
        setDeposit(null);
        setIdentityRequired(null);
        setError(
          publicProviderMessage(
            e instanceof Error ? e.message : 'Could not load funding options',
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [applyOptions],
  );

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
      'We’re matching your bank payment. This can take a few minutes.',
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
      const msg = publicProviderMessage(
        e instanceof Error ? e.message : 'Could not check for your deposit',
      );
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
      const json = await api.post<FundOptions>(endpoints.wallet.depositAccount, {
        idType,
        idNumber: digits,
      });
      applyOptions(json);
      if (json.account) {
        setIdNumber('');
        alert.success('Account ready', 'Your fund account is ready.');
        return;
      }
      setError(publicProviderMessage(json.error || 'Could not create your fund account. Try again.'));
    } catch (e) {
      setError(
        publicProviderMessage(
          e instanceof Error ? e.message : 'Could not save your details. Try again.',
        ),
      );
    } finally {
      setSubmittingIdentity(false);
    }
  }

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const currentBalance = Number(wallet?.balance ?? 0);
  const resultingBalance = amountValid ? currentBalance + amountNum : null;

  const depositDetails = useMemo(() => {
    if (!amountValid) return null;
    return {
      amount: amountNum,
      currency,
      methodLabel: formatPaymentOptions(paymentOptions),
      feeLabel: 'Provider fees may apply at checkout',
      creditedFormatted: formatMoney(amountNum, currency),
      payFormatted: formatMoney(amountNum, currency),
      resultingFormatted:
        resultingBalance != null ? formatMoney(resultingBalance, currency) : null,
    };
  }, [amountValid, amountNum, currency, paymentOptions, resultingBalance]);

  async function onPayWithCard() {
    if (!depositDetails) return;
    setPaying(true);
    setError(null);
    try {
      const callbackUrl = Linking.createURL('fund', {
        scheme: 'oryno',
        queryParams: { local_fund: '1' },
      });
      const json = await api.post<{
        error?: string;
        authorizationUrl?: string;
        reference?: string;
      }>(endpoints.wallet.fundInitialize, {
        amount: depositDetails.amount,
        callbackUrl,
      });

      if (!json.authorizationUrl) {
        throw new Error('Payment page unavailable. Try again.');
      }

      await WebBrowser.openBrowserAsync(json.authorizationUrl);

      if (json.reference) {
        try {
          const verified = await api.post<{
            transactionId?: string;
            amountFormatted?: string;
          }>(endpoints.wallet.fundVerify, { reference: json.reference });
          toast.success('Wallet funded successfully', {
            description: verified.amountFormatted,
          });
          invalidateWallet();
          await refreshWallet();
          if (verified.transactionId) {
            redirectedRef.current = true;
            router.replace(`/(app)/history/${verified.transactionId}`);
            return;
          }
        } catch {
          // Payment may still be pending — wallet poll will pick it up.
          await refreshWallet();
        }
      } else {
        await refreshWallet();
      }
    } catch (err) {
      setError(
        publicProviderMessage(
          err instanceof Error ? err.message : 'Could not start payment',
        ),
      );
      setConfirming(false);
    } finally {
      setPaying(false);
    }
  }

  const showCheckout =
    checkoutAvailable &&
    (preferCheckout || (!deposit && !identityRequired));
  const showIdentity = Boolean(identityRequired) && !preferCheckout;
  const showDva = Boolean(deposit) && !preferCheckout && !identityRequired;

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      header={
        <PageHeader
          title="Fund Wallet"
          subtitle={
            showCheckout
              ? 'Deposit by card or mobile money'
              : 'Transfer to your dedicated account'
          }
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
      ) : showCheckout ? (
        <Animated.View entering={cardEntering(0).delay(40)} style={styles.card}>
          <View style={styles.identityHead}>
            <View style={styles.identityIcon}>
              <Ionicons name="card" size={22} color={Brand.orange} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.identityTitle}>Deposit by card</Text>
              <Text style={styles.identitySub}>
                Your country doesn&apos;t offer a dedicated account number. Pay with
                card or mobile money — your {currency} wallet is credited after
                payment.
              </Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Amount ({currency})</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v.replace(/[^\d.]/g, ''));
              setConfirming(false);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />

          <View style={styles.presetRow}>
            {presets.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  setAmount(p);
                  setConfirming(false);
                }}
                style={[styles.preset, amount === p && styles.presetActive]}>
                <Text
                  style={[
                    styles.presetText,
                    amount === p && styles.presetTextActive,
                  ]}>
                  {formatMoney(Number(p), currency)}
                </Text>
              </Pressable>
            ))}
          </View>

          {depositDetails ? (
            <View style={styles.detailsBox}>
              <Text style={styles.detailsEyebrow}>DEPOSIT DETAILS</Text>
              <PlainRow
                label="You pay"
                value={depositDetails.payFormatted}
                emphasize
                colors={colors}
                styles={styles}
              />
              <PlainRow
                label="Currency"
                value={depositDetails.currency}
                colors={colors}
                styles={styles}
              />
              <PlainRow
                label="Payment methods"
                value={depositDetails.methodLabel}
                colors={colors}
                styles={styles}
              />
              <PlainRow label="ORYNO fee" value="Free" colors={colors} styles={styles} />
              <PlainRow
                label="Provider fee"
                value={depositDetails.feeLabel}
                colors={colors}
                styles={styles}
              />
              <PlainRow
                label="Credited to wallet"
                value={depositDetails.creditedFormatted}
                emphasize
                colors={colors}
                styles={styles}
              />
              {depositDetails.resultingFormatted ? (
                <PlainRow
                  label="Balance after deposit"
                  value={depositDetails.resultingFormatted}
                  colors={colors}
                  styles={styles}
                />
              ) : null}
              <Text style={styles.instructions}>
                You’ll complete payment securely. Funds land in your
                local ({currency}) wallet 1:1 after confirmation.
              </Text>
            </View>
          ) : null}

          {!confirming ? (
            <Pressable
              style={[styles.primaryBtn, !depositDetails && { opacity: 0.5 }]}
              disabled={!depositDetails}
              onPress={() => setConfirming(true)}>
              <Ionicons name="card" size={18} color={Brand.white} />
              <Text style={styles.primaryBtnText}>Review deposit</Text>
            </Pressable>
          ) : (
            <View style={styles.confirmBlock}>
              <Text style={styles.confirmHint}>
                Confirm the deposit details above. You’ll be redirected to pay with
                your card or mobile money.
              </Text>
              <View style={styles.confirmRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => setConfirming(false)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    styles.confirmPrimary,
                    paying && { opacity: 0.7 },
                  ]}
                  disabled={paying}
                  onPress={() => void onPayWithCard()}>
                  {paying ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Pay now</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {preferCheckout && (deposit || identityRequired) ? (
            <Pressable
              style={styles.kycLink}
              onPress={() => setPreferCheckout(false)}>
              <Text style={styles.kycLinkText}>Use bank account instead</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : showIdentity ? (
        <Animated.View entering={cardEntering(0).delay(40)} style={styles.card}>
          <View style={styles.identityHead}>
            <View style={styles.identityIcon}>
              <Ionicons name="shield-checkmark" size={22} color={Brand.orange} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.identityTitle}>Verify to get your account number</Text>
              <Text style={styles.identitySub}>{identityRequired!.message}</Text>
            </View>
          </View>

          <View style={styles.segRow}>
            {identityRequired!.idTypes.map((type) => (
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
            We use your {idType} only to create your personal fund account. It must
            match your name on ORYNO.
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

          {checkoutAvailable ? (
            <Pressable
              style={styles.kycLink}
              onPress={() => {
                setPreferCheckout(true);
                setConfirming(false);
              }}>
              <Text style={styles.kycLinkText}>Or deposit by card instead</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : showDva ? (
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
              <DetailRow
                label="Bank"
                value={deposit.bankName}
                colors={colors}
                styles={styles}
              />
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
              <DetailRow
                label="Currency"
                value={deposit.currency}
                colors={colors}
                styles={styles}
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

          {checkoutAvailable ? (
            <Pressable
              style={styles.kycLink}
              onPress={() => {
                setPreferCheckout(true);
                setConfirming(false);
              }}>
              <Text style={styles.kycLinkText}>Prefer card deposit?</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View entering={cardEntering(0).delay(40)} style={styles.card}>
          <View style={styles.emptyCard}>
            <MaterialIcons name="account-balance" size={28} color={Brand.orange} />
            <Text style={styles.emptyTitle}>Funding unavailable</Text>
            <Text style={styles.emptySub}>Try refresh in a moment.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void load()}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {deposit && !identityRequired && !preferCheckout ? (
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

function PlainRow({
  label,
  value,
  emphasize,
  colors,
  styles,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.plainRow}>
      <Text style={styles.plainLabel}>{label}</Text>
      <Text
        style={[
          styles.plainValue,
          { color: emphasize ? Brand.orange : colors.foreground },
        ]}>
        {value}
      </Text>
    </View>
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
      gap: 12,
      marginTop: 4,
    },
    detailsEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: colors.mutedForeground,
    },
    plainRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    plainLabel: { fontSize: 13, color: colors.mutedForeground },
    plainValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1 },
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
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    preset: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.muted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    presetActive: {
      backgroundColor: Brand.orange,
      borderColor: Brand.orange,
    },
    presetText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
    presetTextActive: { color: Brand.white },
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
      flexDirection: 'row',
      gap: 8,
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
    confirmBlock: { marginTop: 16, gap: 12 },
    confirmHint: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.mutedForeground,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 12,
      padding: 12,
    },
    confirmRow: { flexDirection: 'row', gap: 8 },
    secondaryBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    confirmPrimary: { flex: 1, marginTop: 0 },
  });
}
