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
import Animated from 'react-native-reanimated';

import { cardEntering } from '@/lib/motion';

import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { SelectSheet } from '@/components/app/picker-sheet';
import { ServiceSuccess } from '@/components/app/service-success';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import { useBettingProviders } from '@/hooks/use-service-catalogs';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { api } from '@/lib/api';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney } from '@/lib/format';

const FALLBACK_PRESETS = ['500', '1000', '2000', '5000', '10000'];
const VERIFY_DEBOUNCE_MS = 800;

export default function BettingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode, countryName, loading: countryLoading } = useProfile();
  const { canAfford, frozen } = useWalletBalance();
  const invalidateWallet = useInvalidateWallet();
  const subtitle = `Fund ${countryName} bookmakers from your wallet`;
  const currencyPrefix = getCountryInfo(countryCode).currencySymbol;

  const providersQuery = useBettingProviders(!countryLoading);
  const services = providersQuery.data?.services ?? [];
  const presets = providersQuery.data?.presets ?? FALLBACK_PRESETS;
  const demoMode = Boolean(providersQuery.data?.demo);
  const loadingServices =
    countryLoading || (providersQuery.isLoading && !providersQuery.data);

  const [serviceID, setServiceID] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [amount, setAmount] = useState('2000');
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [verifyHint, setVerifyHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const amountNumber = Number(amount) || 0;
  const minAmount = selectedService?.minAmount ?? 100;
  const money = (n: number) => formatCountryMoney(n, countryCode || 'NG');

  const canSubmit = useMemo(
    () =>
      Boolean(serviceID && customerRef.trim().length >= 6 && customerName) &&
      !verifying &&
      amountNumber >= minAmount &&
      !submitting &&
      !frozen &&
      canAfford(amountNumber),
    [
      serviceID,
      customerRef,
      customerName,
      verifying,
      amountNumber,
      minAmount,
      submitting,
      frozen,
      canAfford,
    ],
  );

  useEffect(() => {
    if (!services.length) {
      setServiceID('');
      return;
    }
    setServiceID((prev) =>
      prev && services.some((s) => s.serviceID === prev)
        ? prev
        : services[0].serviceID,
    );
  }, [services]);

  useEffect(() => {
    if (presets[1] || presets[0]) {
      setAmount(presets[1] || presets[0]);
    }
  }, [presets]);

  useEffect(() => {
    if (providersQuery.error) {
      setError(
        providersQuery.error instanceof Error
          ? providersQuery.error.message
          : 'Failed to load bookmakers',
      );
    }
  }, [providersQuery.error]);

  // Auto-verify betting account when ID is long enough (website parity).
  useEffect(() => {
    if (!serviceID || customerRef.trim().length < 6) {
      setCustomerName(null);
      setVerifying(false);
      setVerifyHint(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setVerifying(true);
        setVerifyHint(null);
        try {
          const data = await api.post<{ customerName?: string }>(
            endpoints.services.bettingVerify,
            {
              serviceID,
              customerRef: customerRef.trim(),
            },
          );
          if (cancelled) return;
          setCustomerName(data.customerName || 'Verified customer');
          setVerifyHint(null);
        } catch (e) {
          if (cancelled) return;
          setCustomerName(null);
          setVerifyHint(
            e instanceof Error ? e.message : 'Could not verify that account',
          );
        } finally {
          if (!cancelled) setVerifying(false);
        }
      })();
    }, VERIFY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serviceID, customerRef]);

  async function onSubmit() {
    if (!canSubmit || !selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        amountFormatted?: string;
        token?: string;
        requestId?: string;
        transactionId?: string;
      }>(endpoints.services.bettingFund, {
        serviceID,
        serviceName: selectedService.name,
        customerRef: customerRef.trim(),
        customerName,
        amount: amountNumber,
      });
      setReceipt(data.amountFormatted || money(amountNumber));
      setToken(data.token || data.requestId || null);
      setTransactionId(data.transactionId || null);
      invalidateWallet();
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Funding failed');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSuccess(false);
    setToken(null);
    setTransactionId(null);
    setCustomerName(null);
    setVerifyHint(null);
  }

  return (
    <Screen
      scroll
      footer={
        <Pressable
          disabled={!canSubmit}
          onPress={() => void onSubmit()}
          style={({ pressed }) => [
            styles.submitBtn,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && { opacity: 0.92 },
          ]}>
          <Text style={styles.submitText}>
            {submitting
              ? 'Funding…'
              : frozen
                ? 'Wallet unavailable'
                : !customerName
                  ? verifying
                    ? 'Verifying account…'
                    : 'Verify account to continue'
                  : amountNumber > 0 && !canAfford(amountNumber)
                    ? 'Insufficient balance'
                    : `Fund wallet · ${money(amountNumber)}`}
          </Text>
        </Pressable>
      }
      header={
        <PageHeader title="Betting Funding" subtitle={subtitle} showBack />
      }>
      {success ? (
        <ServiceSuccess
          title={demoMode ? 'Demo wallet funded!' : 'Betting wallet funded!'}
          subtitle={`${selectedService?.name || 'Bookmaker'} credited successfully.`}
          amountLabel="Amount charged"
          amount={receipt || money(amountNumber)}
          onDismiss={resetForm}
          primaryAction={
            transactionId
              ? {
                  label: 'View receipt',
                  onPress: () =>
                    router.push(`/(app)/history/${transactionId}` as never),
                  icon: 'receipt',
                }
              : undefined
          }
          tertiaryAction={{
            label: 'Fund another account',
            onPress: resetForm,
            icon: 'plus',
          }}>
          {token ? (
            <Text style={styles.tokenBox} selectable>
              Reference: {token}
            </Text>
          ) : null}
        </ServiceSuccess>
      ) : null}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Betting Funding"
      />

      <Animated.View entering={cardEntering(0)} style={styles.section}>
        <SelectSheet
          label="Bookmaker"
          title="Select bookmaker"
          subtitle="Bet9ja, SportyBet, 1xBet and more"
          hint="Tap to choose a bookmaker"
          value={serviceID}
          valueLabel={selectedService?.name}
          onChange={(id) => {
            setServiceID(id);
            setCustomerName(null);
            setVerifyHint(null);
          }}
          loading={loadingServices}
          emptyText="No bookmakers available"
          fullScreen={false}
          options={services.map((s) => ({
            id: s.serviceID,
            title: s.name,
            image: s.image ?? null,
            domain: s.domain,
            imageFallbacks: s.imageFallbacks,
            subtitle: 'Tap to select',
          }))}
        />
        {error && !services.length ? (
          <Pressable
            style={styles.retryBtn}
            onPress={() => void providersQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={cardEntering(40)} style={styles.section}>
        <Text style={styles.sectionTitle}>Betting account ID</Text>
        <TextInput
          value={customerRef}
          onChangeText={(t) => {
            setCustomerRef(t.replace(/\s+/g, ''));
            setCustomerName(null);
            setVerifyHint(null);
          }}
          keyboardType="number-pad"
          placeholder="e.g. 12345678"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />
        {verifying ? (
          <Text style={styles.verifyMuted}>Checking account…</Text>
        ) : customerName ? (
          <Text style={styles.verifyOk}>{customerName}</Text>
        ) : verifyHint ? (
          <Text style={styles.verifyErr}>{verifyHint}</Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={cardEntering(80)} style={styles.section}>
        <Text style={styles.sectionTitle}>Amount</Text>
        <View style={styles.amountWrap}>
          <Text style={styles.currencyPrefix}>{currencyPrefix}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            placeholder={String(minAmount)}
            placeholderTextColor={colors.mutedForeground}
            style={styles.amountInput}
          />
        </View>
        <View style={styles.presets}>
          {presets.map((p) => {
            const active = amount === p;
            return (
              <Pressable
                key={p}
                onPress={() => setAmount(p)}
                style={[styles.presetChip, active && styles.presetChipActive]}>
                <Text style={[styles.presetText, active && styles.presetTextActive]}>
                  {money(Number(p))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={cardEntering(100)} style={styles.summaryCard}>
        <Text style={styles.summaryHeading}>Order summary</Text>
        <SummaryRow label="Bookmaker" value={selectedService?.name ?? '—'} />
        <SummaryRow label="Account ID" value={customerRef || '—'} />
        <SummaryRow
          label="Customer"
          value={
            verifying
              ? 'Checking…'
              : customerName || (verifyHint ? 'Not verified' : '—')
          }
        />
        <SummaryRow label="Amount" value={money(amountNumber)} accent />
        <View style={styles.payRow}>
          <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
          <Text style={styles.payText}>Pay from wallet</Text>
        </View>
      </Animated.View>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, accent && styles.summaryAccent]}
        numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 20,
      gap: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.foreground,
    },
    input: {
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    verifyMuted: {
      paddingHorizontal: 4,
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    verifyOk: {
      paddingHorizontal: 4,
      fontSize: 14,
      fontWeight: '600',
      color: Brand.success,
    },
    verifyErr: {
      paddingHorizontal: 4,
      fontSize: 14,
      fontWeight: '500',
      color: Brand.error,
    },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
    },
    currencyPrefix: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.mutedForeground,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
      height: '100%',
    },
    presets: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    presetChip: {
      borderRadius: 999,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    presetChipActive: { backgroundColor: Brand.orange },
    presetText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.foreground,
    },
    presetTextActive: { color: Brand.white },
    summaryCard: {
      marginBottom: 8,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 10,
    },
    summaryHeading: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 2,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    summaryValue: {
      maxWidth: '60%',
      textAlign: 'right',
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    summaryAccent: { color: Brand.orange },
    payRow: {
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    payText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    submitBtn: {
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
    retryBtn: {
      alignSelf: 'center',
      backgroundColor: Brand.orange,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    tokenBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 12,
      fontWeight: '500',
      color: colors.foreground,
    },
  });
}
