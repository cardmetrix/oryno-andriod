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
import { TelecomNetworkGrid } from '@/components/app/telecom-network-grid';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import { useVtpassServices } from '@/hooks/use-service-catalogs';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { api } from '@/lib/api';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney, formatServiceMoney } from '@/lib/format';

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const NG_PRESETS = ['1000', '2000', '5000', '10000', '20000'];
const GH_PRESETS = ['20', '50', '100', '200', '500'];
const KE_PRESETS = ['200', '500', '1000', '2000', '5000'];
const ZA_PRESETS = ['50', '100', '200', '500', '1000'];

const VERIFY_DEBOUNCE_MS = 800;
const TOKEN_POLL_DELAY_MS = 2500;
const TOKEN_POLL_INTERVAL_MS = 3000;
const TOKEN_POLL_MAX_ATTEMPTS = 40;

export default function ElectricityScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode, countryName, loading: countryLoading, displayFx } =
    useProfile();
  const { canAfford, frozen } = useWalletBalance();
  const invalidateWallet = useInvalidateWallet();

  const isNigeria = countryCode === 'NG';
  const isGhana = countryCode === 'GH';
  const isKenya = countryCode === 'KE';
  const isSouthAfrica = countryCode === 'ZA';
  const live = isNigeria || isGhana || isKenya || isSouthAfrica;
  const currencyPrefix = getCountryInfo(countryCode).currencySymbol;

  const [serviceID, setServiceID] = useState('');
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState(
    isSouthAfrica ? '100' : isKenya ? '500' : isGhana ? '50' : '2000',
  );
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [verifyHint, setVerifyHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const minAmount = isNigeria
    ? 1000
    : isSouthAfrica
      ? 10
      : isKenya
        ? 50
        : isGhana
          ? 1
          : 100;

  const servicesQuery = useVtpassServices(
    'electricity-bill',
    !countryLoading && live,
  );
  const services = servicesQuery.data ?? [];
  const loadingServices =
    countryLoading || (servicesQuery.isLoading && !servicesQuery.data);

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedVariation = variations.find(
    (v) => v.variationCode === variationCode,
  );
  const amountNumber = Number(amount) || 0;

  const money = (n: number) =>
    isSouthAfrica
      ? formatCountryMoney(n, 'ZA')
      : isKenya
        ? formatCountryMoney(n, 'KE')
        : isGhana
          ? formatCountryMoney(n, 'GH')
          : formatServiceMoney(n, countryCode, displayFx?.ngnToLocal ?? 1);

  const amountPresets = isSouthAfrica
    ? ZA_PRESETS
    : isKenya
      ? KE_PRESETS
      : isGhana
        ? GH_PRESETS
        : NG_PRESETS;

  const subtitle = isSouthAfrica
    ? 'Eskom & City Power'
    : isKenya
      ? 'Kenya Power (KPLC)'
      : isGhana
        ? 'ECG prepaid & postpaid'
        : 'All major discos · prepaid & postpaid';

  const customerLabel = selectedService?.customerLabel || 'Meter number';

  const canSubmit = useMemo(() => {
    const verifiedOk = !isNigeria || Boolean(customerName);
    return (
      Boolean(serviceID && variationCode && meterNumber.trim().length >= 6) &&
      verifiedOk &&
      !verifying &&
      amountNumber >= minAmount &&
      !submitting &&
      live &&
      !frozen &&
      canAfford(amountNumber)
    );
  }, [
    serviceID,
    variationCode,
    meterNumber,
    customerName,
    verifying,
    isNigeria,
    amountNumber,
    submitting,
    minAmount,
    live,
    frozen,
    canAfford,
  ]);

  useEffect(() => {
    if (isSouthAfrica) setAmount('100');
    else if (isKenya) setAmount('500');
    else if (isGhana) setAmount('50');
    else setAmount('2000');
  }, [isSouthAfrica, isKenya, isGhana, countryCode]);

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
    if (servicesQuery.error) {
      setError(
        servicesQuery.error instanceof Error
          ? servicesQuery.error.message
          : 'Failed to load discos',
      );
    }
  }, [servicesQuery.error]);

  useEffect(() => {
    if (!serviceID) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      setVariationCode('');
      try {
        const data = await api.get<{
          variations?: {
            variationCode?: string;
            variation_code?: string;
            name: string;
            amount?: number;
            variation_amount?: string | number;
            fixedPrice?: boolean;
          }[];
        }>(
          `${endpoints.services.variations}?serviceID=${encodeURIComponent(serviceID)}&identifier=electricity-bill`,
        );
        if (cancelled) return;
        const next: Variation[] = (data.variations ?? []).map((v) => ({
          variationCode: String(v.variationCode ?? v.variation_code ?? ''),
          name: v.name,
          amount: Number(v.amount ?? v.variation_amount) || 0,
          fixedPrice: Boolean(v.fixedPrice),
        }));
        setVariations(next);
        if (next[0]?.variationCode) setVariationCode(next[0].variationCode);
      } catch (e) {
        if (!cancelled) {
          setVariations([]);
          setError(
            e instanceof Error ? e.message : 'Failed to load meter types',
          );
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceID]);

  // Auto-verify meter when digits are long enough.
  useEffect(() => {
    if (!live || !serviceID || meterNumber.trim().length < 6) {
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
          const data = await api.post<{
            customerName?: string;
            renewalAmount?: number | string;
          }>(endpoints.services.billsVerify, {
            billersCode: meterNumber.trim(),
            serviceID,
            category: 'electricity',
            type: variationCode || undefined,
          });
          if (cancelled) return;
          setCustomerName(data.customerName || 'Verified customer');
          setVerifyHint(null);
          if (data.renewalAmount) {
            setAmount(String(Math.round(Number(data.renewalAmount))));
          }
        } catch (e) {
          if (cancelled) return;
          setCustomerName(null);
          setVerifyHint(
            e instanceof Error ? e.message : 'Could not verify that meter',
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
  }, [live, serviceID, meterNumber, variationCode]);

  // Poll electricity token after async purchase.
  useEffect(() => {
    if (!pending || !paymentId) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      attempts += 1;
      try {
        const data = await api.get<{
          status?: string;
          token?: string | null;
          failureReason?: string | null;
        }>(
          `${endpoints.services.billsStatus}?paymentId=${encodeURIComponent(paymentId)}`,
        );
        if (cancelled) return;
        if (data.token) setToken(String(data.token));
        if (data.status === 'completed') {
          setPending(false);
          setSuccess(true);
          invalidateWallet();
          return;
        }
        if (data.status === 'failed') {
          setPending(false);
          setSuccess(false);
          setError(data.failureReason || 'Electricity payment failed');
          invalidateWallet();
          return;
        }
      } catch {
        // keep polling
      }
      if (cancelled) return;
      if (attempts < TOKEN_POLL_MAX_ATTEMPTS) {
        timer = setTimeout(() => void tick(), TOKEN_POLL_INTERVAL_MS);
      } else if (!cancelled) {
        setPending(false);
        setSuccess(true);
      }
    };

    timer = setTimeout(() => void tick(), TOKEN_POLL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, paymentId, invalidateWallet]);

  async function onSubmit() {
    if (!canSubmit || !selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        amountFormatted?: string;
        token?: string;
        status?: string;
        paymentId?: string;
        transactionId?: string;
      }>(endpoints.services.billsPurchase, {
        serviceID,
        serviceName: selectedService.name,
        category: 'electricity',
        customerRef: meterNumber.trim(),
        amount: amountNumber,
        variationCode,
        recipientName: customerName,
      });
      setReceipt(data.amountFormatted || money(amountNumber));
      setToken(data.token || null);
      setPaymentId(data.paymentId || null);
      setTransactionId(data.transactionId || null);
      if (
        (data.status === 'processing' || data.status === 'pending') &&
        !data.token
      ) {
        setPending(true);
        setSuccess(true);
      } else {
        setPending(false);
        setSuccess(true);
      }
      invalidateWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  }

  function resetSuccess() {
    setSuccess(false);
    setPending(false);
    setToken(null);
    setPaymentId(null);
    setTransactionId(null);
  }

  if (!countryLoading && !live) {
    return (
      <Screen
        scroll
        header={
          <PageHeader
            title="Electricity"
            subtitle="Prepaid & postpaid"
            showBack
          />
        }>
        <Animated.View entering={cardEntering(0)} style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <Ionicons name="flash-outline" size={28} color={Brand.orange} />
          </View>
          <Text style={styles.gateTitle}>
            {countryName || 'Your country'} electricity coming next
          </Text>
          <Text style={styles.gateSub}>
            Electricity top-ups for {countryName || 'this market'} will go live
            soon. Airtime and data already work.
          </Text>
          <Button
            title="Buy airtime instead"
            onPress={() => router.push('/(app)/services/airtime')}
            style={{ marginTop: 20, alignSelf: 'stretch' }}
          />
        </Animated.View>
      </Screen>
    );
  }

  const showFormSkeleton = !success && loadingServices;

  return (
    <Screen
      scroll
      footer={
        showFormSkeleton ? undefined : (
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
              ? 'Processing…'
              : frozen
                ? 'Wallet unavailable'
                : isNigeria && !customerName
                  ? verifying
                    ? 'Verifying meter…'
                    : 'Verify meter to continue'
                  : amountNumber > 0 && !canAfford(amountNumber)
                    ? 'Insufficient balance'
                    : `Pay electricity · ${money(amountNumber)}`}
          </Text>
        </Pressable>
        )
      }
      header={<PageHeader title="Electricity" subtitle={subtitle} showBack />}>
      {success ? (
        <ServiceSuccess
          variant={pending && !token ? 'pending' : 'success'}
          title={
            pending && !token
              ? 'Payment processing'
              : token
                ? 'Token ready!'
                : 'Electricity paid!'
          }
          subtitle={
            pending && !token
              ? `${selectedService?.name || 'Disco'} is processing. Your token will appear here shortly.`
              : `${selectedService?.name || 'Electricity'} paid successfully.`
          }
          amountLabel="Amount charged"
          amount={receipt || money(amountNumber)}
          reference={transactionId}
          onDismiss={resetSuccess}
          tertiaryAction={{
            label: 'Buy again',
            onPress: resetSuccess,
            icon: 'plus',
          }}>
          {token ? (
            <Text style={styles.tokenBox} selectable>
              Token / receipt: {token}
            </Text>
          ) : pending ? (
            <Text style={styles.pendingHint}>
              Waiting for disco token… this usually takes a few seconds.
            </Text>
          ) : null}
        </ServiceSuccess>
      ) : null}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Electricity"
      />

      {showFormSkeleton ? (
        <FormSkeleton />
      ) : success ? null : (
        <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Disco</Text>
        <TelecomNetworkGrid
          services={services}
          value={serviceID}
          onChange={(id) => {
            setServiceID(id);
            setCustomerName(null);
            setVerifyHint(null);
          }}
          loading={false}
        />
        {error && !services.length ? (
          <Pressable
            style={styles.retryBtn}
            onPress={() => void servicesQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{customerLabel}</Text>
        <TextInput
          value={meterNumber}
          onChangeText={(t) => {
            setMeterNumber(t);
            setCustomerName(null);
            setVerifyHint(null);
          }}
          placeholder={customerLabel}
          keyboardType="number-pad"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />
        {verifying ? (
          <Text style={styles.verifyMuted}>Checking meter…</Text>
        ) : customerName ? (
          <Text style={styles.verifyOk}>{customerName}</Text>
        ) : verifyHint ? (
          <Text style={styles.verifyErr}>{verifyHint}</Text>
        ) : (
          <Text style={styles.verifyHint}>
            Enter at least 6 digits — we verify the account automatically.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SelectSheet
          label="Meter type"
          title="Select meter type"
          subtitle="Prepaid or postpaid"
          hint="Tap to choose"
          value={variationCode}
          valueLabel={selectedVariation?.name}
          onChange={setVariationCode}
          loading={loadingPlans}
          emptyText="No meter types available"
          fullScreen={false}
          options={variations.map((v) => ({
            id: v.variationCode,
            title: v.name,
          }))}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amount</Text>
        <View style={styles.amountWrap}>
          <Text style={styles.currencyPrefix}>{currencyPrefix}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder={String(minAmount)}
            placeholderTextColor={colors.mutedForeground}
            style={styles.amountInput}
          />
        </View>
        <View style={styles.presets}>
          {amountPresets.map((preset) => {
            const active = amount === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => setAmount(preset)}
                style={[styles.presetChip, active && styles.presetChipActive]}>
                <Text style={[styles.presetText, active && styles.presetTextActive]}>
                  {money(Number(preset))}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {isNigeria ? (
          <Text style={styles.minHint}>Minimum top-up is {money(minAmount)}.</Text>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <SummaryRow label="Disco" value={selectedService?.name ?? '—'} />
        <SummaryRow label="Meter" value={meterNumber || '—'} />
        <SummaryRow label="Type" value={selectedVariation?.name ?? '—'} />
        <SummaryRow label="Amount" value={money(amountNumber)} accent />
        <View style={styles.payRow}>
          <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
          <Text style={styles.payText}>Pay from wallet</Text>
        </View>
      </View>
        </>
      )}
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
    verifyHint: {
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
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
      gap: 10,
    },
    presetChip: {
      width: '31%',
      flexGrow: 1,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    presetChipActive: { backgroundColor: Brand.orange },
    presetText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    presetTextActive: { color: Brand.white },
    minHint: {
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    summaryCard: {
      marginBottom: 8,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 10,
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
    pendingHint: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    gateCard: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 24,
      paddingVertical: 36,
      alignItems: 'center',
    },
    gateIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gateTitle: {
      marginTop: 16,
      fontSize: 18,
      fontWeight: '800',
      color: colors.foreground,
      textAlign: 'center',
    },
    gateSub: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
