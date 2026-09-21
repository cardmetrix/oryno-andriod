import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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

import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { SelectSheet } from '@/components/app/picker-sheet';
import { ServiceInstructions } from '@/components/app/service-instructions';
import { ServiceSuccess } from '@/components/app/service-success';
import {
  VtpassServicePicker
} from '@/components/app/vtpass-service-picker';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import { useVariations, useVtpassServices } from '@/hooks/use-service-catalogs';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney, formatServiceMoney } from '@/lib/format';

type BillCategory = 'tv' | 'electricity' | 'water';

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const NG_PRESETS = ['1000', '2000', '5000', '10000'];
const GH_PRESETS = ['20', '50', '100', '200', '500'];
const KE_PRESETS = ['200', '500', '1000', '2000', '5000'];
const ZA_PRESETS = ['50', '100', '200', '500', '1000'];

const VERIFY_DEBOUNCE_MS = 800;
const TOKEN_POLL_DELAY_MS = 2500;
const TOKEN_POLL_INTERVAL_MS = 3000;
const TOKEN_POLL_MAX_ATTEMPTS = 40;

function parseBillCategory(raw?: string | string[]): BillCategory {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'electricity' || value === 'water' || value === 'tv') return value;
  return 'tv';
}

export default function BillsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ category?: string }>();
  const { countryCode, countryName, loading: countryLoading, displayFx } = useProfile();
  const invalidateWallet = useInvalidateWallet();
  const { canAfford, frozen } = useWalletBalance();
  const isNigeria = countryCode === 'NG';
  const isGhana = countryCode === 'GH';
  const isKenya = countryCode === 'KE';
  const isSouthAfrica = countryCode === 'ZA';
  const localCurrencyBills = isGhana || isKenya || isSouthAfrica;
  const billsLive = isNigeria || localCurrencyBills;
  const minBillAmount = isSouthAfrica ? 10 : isKenya ? 50 : isGhana ? 1 : 100;
  const billsSubtitle = isSouthAfrica
    ? 'DStv, Eskom & Johannesburg Water'
    : isKenya
      ? 'DStv, KPLC & Nairobi Water'
      : isGhana
        ? 'DStv, ECG & Ghana Water'
        : 'TV subscriptions & electricity';

  // Dedicated screens for electricity / TV (website parity).
  useEffect(() => {
    const cat = parseBillCategory(params.category);
    if (cat === 'electricity') {
      router.replace('/(app)/services/electricity');
    } else if (cat === 'tv') {
      router.replace('/(app)/services/tv');
    }
  }, [params.category]);
  const [category, setCategory] = useState<BillCategory>(() =>
    parseBillCategory(params.category),
  );

  useEffect(() => {
    setCategory(parseBillCategory(params.category));
  }, [params.category]);

  const pageTitle =
    category === 'electricity'
      ? 'Electricity'
      : category === 'water'
        ? 'Water Bills'
        : 'TV Bills';
  const pageSubtitle =
    category === 'electricity'
      ? isSouthAfrica
        ? 'Eskom & City Power'
        : isKenya
          ? 'Kenya Power (KPLC)'
          : isGhana
            ? 'ECG prepaid & postpaid'
            : 'Prepaid & postpaid discos'
      : category === 'water'
        ? billsSubtitle
        : isSouthAfrica
          ? 'DStv, GOtv & Johannesburg Water'
          : isKenya
            ? 'DStv, GOtv & Nairobi Water'
            : isGhana
              ? 'DStv, GOtv & Ghana Water'
              : 'DStv, GOtv & StarTimes';
  const [serviceID, setServiceID] = useState('');
  const [variationCode, setVariationCode] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [amount, setAmount] = useState('2000');
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [verifyHint, setVerifyHint] = useState<string | null>(null);
  const [verifyNonce, setVerifyNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [retailAmount, setRetailAmount] = useState<number | null>(null);

  const identifier =
    category === 'tv'
      ? 'tv-subscription'
      : category === 'water'
        ? 'water-bill'
        : 'electricity-bill';
  const servicesQuery = useVtpassServices(identifier, !countryLoading && billsLive);
  const services = servicesQuery.data ?? [];
  const loadingServices =
    countryLoading || (servicesQuery.isLoading && !servicesQuery.data);
  const variationsQuery = useVariations(serviceID, Boolean(serviceID) && billsLive);
  const variations: Variation[] = useMemo(
    () =>
      (variationsQuery.data ?? []).map((v) => ({
        variationCode: String(v.variationCode ?? v.variation_code ?? ''),
        name: v.name,
        amount: Number(v.amount ?? v.variation_amount) || 0,
        fixedPrice: Boolean(v.fixedPrice),
      })),
    [variationsQuery.data],
  );
  const loadingPlans = variationsQuery.isLoading && !variationsQuery.data;

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedVariation = variations.find((v) => v.variationCode === variationCode);

  const refNoun =
    category === 'tv' ? 'smartcard' : category === 'water' ? 'account' : 'meter';
  const customerLabel =
    selectedService?.customerLabel ||
    (category === 'tv'
      ? 'Smartcard / IUC'
      : category === 'water'
        ? 'Account number'
        : 'Meter number');

  const showAmountField =
    category === 'electricity' ||
    category === 'water' ||
    (Boolean(selectedVariation) && !selectedVariation?.fixedPrice);
  const amountPresets = isSouthAfrica
    ? ZA_PRESETS
    : isKenya
      ? KE_PRESETS
      : isGhana
        ? GH_PRESETS
        : NG_PRESETS;

  const faceAmount = useMemo(() => {
    if (category === 'tv' && selectedVariation?.fixedPrice) {
      // Catalog amount is already admin-priced retail for fixed TV plans.
      return selectedVariation.amount;
    }
    return Number(amount) || 0;
  }, [category, selectedVariation, amount]);

  const amountNumber =
    showAmountField && retailAmount != null && retailAmount > 0
      ? retailAmount
      : faceAmount;

  const money = (n: number) =>
    isSouthAfrica
      ? formatCountryMoney(n, 'ZA')
      : isKenya
        ? formatCountryMoney(n, 'KE')
        : isGhana
          ? formatCountryMoney(n, 'GH')
          : formatServiceMoney(n, countryCode, displayFx?.ngnToLocal ?? 1);

  const canSubmit = useMemo(() => {
    const verifiedOk = !isNigeria || Boolean(customerName);
    return (
      Boolean(serviceID && variationCode && customerRef.trim().length >= 6) &&
      verifiedOk &&
      !verifying &&
      amountNumber >= minBillAmount &&
      !submitting &&
      billsLive &&
      !frozen &&
      canAfford(amountNumber)
    );
  }, [
    serviceID,
    variationCode,
    customerRef,
    customerName,
    verifying,
    isNigeria,
    amountNumber,
    submitting,
    minBillAmount,
    billsLive,
    frozen,
    canAfford,
  ]);

  useEffect(() => {
    if (
      !showAmountField ||
      !serviceID ||
      !variationCode ||
      localCurrencyBills ||
      faceAmount < 100
    ) {
      setRetailAmount(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await api.get<{ retail?: number }>(
            `${endpoints.vtpass.quote}?serviceID=${encodeURIComponent(serviceID)}&variationCode=${encodeURIComponent(variationCode)}&amount=${faceAmount}`,
          );
          if (!cancelled) setRetailAmount(Number(data.retail) || faceAmount);
        } catch {
          if (!cancelled) setRetailAmount(faceAmount);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showAmountField, serviceID, variationCode, faceAmount, localCurrencyBills]);

  useEffect(() => {
    if (isSouthAfrica) setAmount('100');
    else if (isKenya) setAmount('500');
    else if (isGhana) setAmount('50');
    else if (isNigeria) setAmount('2000');
  }, [isSouthAfrica, isKenya, isGhana, isNigeria]);

  useEffect(() => {
    setCustomerName(null);
    setVariationCode('');
    if (!services.length) {
      setServiceID('');
      return;
    }
    setServiceID((prev) =>
      prev && services.some((s) => s.serviceID === prev) ? prev : services[0].serviceID,
    );
  }, [services, category]);

  useEffect(() => {
    if (!variations.length) {
      setVariationCode('');
      return;
    }
    setVariationCode((prev) =>
      prev && variations.some((v) => v.variationCode === prev)
        ? prev
        : variations[0].variationCode,
    );
  }, [variations]);

  useEffect(() => {
    if (servicesQuery.error) {
      setError(
        servicesQuery.error instanceof Error
          ? servicesQuery.error.message
          : 'Failed to load providers',
      );
    } else if (variationsQuery.error) {
      setError(
        variationsQuery.error instanceof Error
          ? variationsQuery.error.message
          : 'Failed to load plans',
      );
    }
  }, [servicesQuery.error, variationsQuery.error]);

  // Auto-verify the smartcard / meter / account once enough digits are entered.
  useEffect(() => {
    if (!billsLive || !serviceID || customerRef.trim().length < 6) {
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
            billersCode: customerRef.trim(),
            serviceID,
            category,
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
            e instanceof Error ? e.message : `Could not verify that ${refNoun}`,
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
  }, [
    billsLive,
    serviceID,
    customerRef,
    category,
    variationCode,
    refNoun,
    verifyNonce,
  ]);

  // Electricity tokens settle asynchronously — poll until the token lands.
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
        // Transient failures are expected while the disco settles — keep polling.
      }
      if (cancelled) return;
      if (attempts < TOKEN_POLL_MAX_ATTEMPTS) {
        timer = setTimeout(() => void tick(), TOKEN_POLL_INTERVAL_MS);
      } else {
        setPending(false);
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
        message?: string;
      }>(endpoints.services.billsPurchase, {
        serviceID,
        serviceName: selectedService.name,
        category,
        customerRef: customerRef.trim(),
        amount: showAmountField ? faceAmount : amountNumber,
        variationCode,
        recipientName: customerName,
      });
      setReceipt(data.amountFormatted || money(amountNumber));
      setToken(data.token || null);
      setPaymentId(data.paymentId || null);
      setTransactionId(data.transactionId || null);
      const settling =
        category === 'electricity' &&
        (data.status === 'processing' || data.status === 'pending') &&
        !data.token &&
        Boolean(data.paymentId);
      setPending(settling);
      invalidateWallet();
      setSuccess(true);
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

  const waitingForToken = pending && !token;

  if (!countryLoading && !billsLive) {
    return (
      <Screen
        scroll
        header={<PageHeader title={pageTitle} subtitle={pageSubtitle} showBack />}>
        <Animated.View entering={cardEntering(0)} style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <Ionicons name="flash-outline" size={28} color={Brand.orange} />
          </View>
          <Text style={styles.gateTitle}>{countryName || 'Local'} bills coming next</Text>
          <Text style={styles.gateSub}>
            {`${countryName || 'Local'} bills will go live next. Airtime and data already work.`}
          </Text>
          <Button
            title="Buy airtime instead"
            style={{ marginTop: 14, width: '100%' }}
            onPress={() => router.push('/(app)/services/airtime')}
          />
        </Animated.View>
        <View style={{ marginTop: 12 }}>
          <ServiceInstructions service="bills" />
        </View>
      </Screen>
    );
  }

  if (success) {
    return (
      <Screen
        scroll
        header={
          <PageHeader
            title={pageTitle}
            subtitle={pageSubtitle}
            showBack
          />
        }>
        <ServiceSuccess
          variant={waitingForToken ? 'pending' : 'success'}
          title={
            waitingForToken ? 'Waiting for token…' : token ? 'Token ready!' : 'Bill paid'
          }
          subtitle={
            waitingForToken
              ? `${selectedService?.name || 'Your provider'} is processing. Your token will appear here shortly.`
              : selectedService?.name || 'Your bill was paid successfully.'
          }
          amountLabel="Amount charged"
          amount={receipt || money(amountNumber)}
          reference={transactionId}
          onDismiss={resetSuccess}
          secondaryAction={{
            label: 'Back to Home',
            onPress: () => router.replace('/(app)/(tabs)'),
            icon: 'home',
          }}
          tertiaryAction={{
            label: 'Pay another bill',
            onPress: resetSuccess,
            icon: 'plus',
          }}>
          {token ? (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenText}>Token / receipt: {token}</Text>
            </View>
          ) : waitingForToken ? (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenText}>
                Waiting for the disco token… this usually takes a few seconds.
              </Text>
            </View>
          ) : null}
        </ServiceSuccess>
      </Screen>
    );
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
              ? 'Paying bill…'
              : frozen
                ? 'Wallet unavailable'
                : isNigeria && !customerName
                  ? verifying
                    ? `Verifying ${refNoun}…`
                    : `Verify ${refNoun} to continue`
                  : amountNumber > 0 && !canAfford(amountNumber)
                    ? 'Insufficient balance'
                    : `Pay bill · ${money(amountNumber)}`}
          </Text>
        </Pressable>
      }
      header={
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          showBack
        />
      }>
      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Bills"
      />

      <Animated.View entering={cardEntering(40)} style={styles.card}>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>
          {category === 'tv'
            ? 'TV providers'
            : category === 'water'
              ? 'Water'
              : localCurrencyBills
                ? 'Electricity'
                : 'Electricity discos'}
        </Text>
        <VtpassServicePicker
          services={services}
          value={serviceID}
          onChange={setServiceID}
          loading={loadingServices || countryLoading}
          label="Provider"
          title={
            category === 'tv'
              ? 'Select TV provider'
              : category === 'water'
                ? 'Select water utility'
                : localCurrencyBills
                  ? 'Select electricity provider'
                  : 'Select electricity disco'
          }
          subtitle={
            category === 'tv'
              ? isSouthAfrica || isKenya || isGhana
                ? 'DStv, GOtv, StarTimes'
                : 'DSTV, GOtv, Startimes & more'
              : category === 'water'
                ? isSouthAfrica
                  ? 'Johannesburg Water'
                  : isKenya
                    ? 'Nairobi Water'
                    : 'Ghana Water Company'
                : isSouthAfrica
                  ? 'Eskom & City Power'
                  : isKenya
                    ? 'KPLC prepaid & postpaid'
                    : isGhana
                      ? 'ECG prepaid & postpaid'
                      : 'Discos across Nigeria'
          }
        />
        {error && !services.length ? (
          <Pressable
            style={styles.retryBtn}
            onPress={() => void servicesQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={cardEntering(80)} style={styles.card}>
        <Text style={styles.fieldLabel}>{customerLabel}</Text>
        <TextInput
          value={customerRef}
          onChangeText={(t) => {
            setCustomerRef(t);
            setCustomerName(null);
            setVerifyHint(null);
          }}
          keyboardType="number-pad"
          placeholder={customerLabel}
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />
        {verifying ? (
          <View style={styles.verifyStatusRow}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={styles.verifyStatusText}>{`Checking ${refNoun}…`}</Text>
          </View>
        ) : customerName ? (
          <Text style={styles.verifiedName}>{customerName}</Text>
        ) : verifyHint ? (
          <View style={styles.verifyStatusRow}>
            <Text style={styles.verifyErrorText}>{verifyHint}</Text>
            <Pressable
              onPress={() => setVerifyNonce((n) => n + 1)}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <Text style={styles.verifyRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.verifyHintText}>
            {`Enter at least 6 digits — we verify the ${refNoun} automatically.`}
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={cardEntering(120)} style={styles.card}>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>
          {category === 'tv' ? 'Bouquets / plans' : 'Meter type'}
        </Text>
        <SelectSheet
          label={category === 'tv' ? 'Bouquet' : 'Meter type'}
          title={category === 'tv' ? 'Select bouquet' : 'Select meter type'}
          subtitle={category === 'tv' ? 'Available TV plans' : 'Prepaid / postpaid options'}
          hint="Tap to choose"
          value={variationCode}
          valueLabel={selectedVariation?.name}
          onChange={setVariationCode}
          loading={loadingPlans}
          emptyText="No plans available"
          options={variations.map((v) => ({
            id: v.variationCode,
            title: v.name,
            trailing: v.fixedPrice && v.amount > 0 ? money(v.amount) : undefined,
          }))}
        />

        {showAmountField ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              placeholder="2000"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <View style={styles.presets}>
              {amountPresets.map((p) => {
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
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={cardEntering(160)} style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Provider" value={selectedService?.name ?? '—'} />
          <SummaryRow
            label={
              category === 'tv'
                ? 'Smartcard'
                : category === 'water'
                  ? 'Account'
                  : 'Meter'
            }
            value={customerRef || '—'}
          />
          <SummaryRow label="Plan" value={selectedVariation?.name ?? '—'} />
          {showAmountField &&
          retailAmount != null &&
          retailAmount !== faceAmount ? (
            <SummaryRow label="Bill value" value={money(faceAmount)} />
          ) : null}
          <SummaryRow label="You pay" value={money(amountNumber)} accent />
          <View style={styles.payRow}>
            <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
            <Text style={styles.payText}>Pay from wallet</Text>
          </View>
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
      <Text style={[styles.summaryValue, accent && styles.summaryAccent]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginBottom: 8,
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      padding: 10,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    fieldLabel: {
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
    },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      fontSize: 14,
      color: colors.charcoal,
    },
    verifyStatusRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    verifyStatusText: { fontSize: 13, fontWeight: '600', color: colors.grayMedium },
    verifyErrorText: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.error },
    verifyRetryText: { fontSize: 13, fontWeight: '800', color: Brand.orange },
    verifyHintText: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    verifiedName: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '700',
      color: Brand.success,
    },
    presets: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    presetChip: {
      borderRadius: 999,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    presetChipActive: { backgroundColor: Brand.orange },
    presetText: { fontSize: 12, fontWeight: '700', color: colors.charcoal },
    presetTextActive: { color: Brand.white },
    summary: { marginTop: 12, gap: 10 },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryLabel: { fontSize: 13, fontWeight: '500', color: colors.grayMedium },
    summaryValue: {
      maxWidth: '60%',
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '700',
      color: colors.charcoal,
    },
    summaryAccent: { color: Brand.orange },
    payRow: {
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.grayDivider,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    payText: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    submitBtn: {
      height: 46,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
    retryBtn: {
      marginTop: 12,
      alignSelf: 'center',
      backgroundColor: Brand.orange,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    gateCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 14,
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
      marginTop: 12,
      fontSize: 18,
      fontWeight: '800',
      color: colors.charcoal,
      textAlign: 'center',
    },
    gateSub: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '500',
      color: colors.grayMedium,
      textAlign: 'center',
      lineHeight: 20,
    },
    successCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 14,
      alignItems: 'center',
    },
    successIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      marginTop: 12,
      fontSize: 22,
      fontWeight: '800',
      color: colors.charcoal,
    },
    successSub: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '500',
      color: colors.grayMedium,
      textAlign: 'center',
    },
    tokenBox: {
      marginTop: 10,
      borderRadius: 14,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 12,
      paddingVertical: 10,
      width: '100%',
    },
    tokenText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.charcoal,
    },
    successActions: { marginTop: 12, width: '100%', gap: 10 },
  });
}
