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

type BillCategory = 'tv' | 'water';

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

export default function TvBillsScreen() {
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
  const hasWaterTab = isGhana || isKenya || isSouthAfrica;
  const currencyPrefix = getCountryInfo(countryCode).currencySymbol;

  const [category, setCategory] = useState<BillCategory>('tv');
  const [serviceID, setServiceID] = useState('');
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [amount, setAmount] = useState(
    isSouthAfrica ? '100' : isKenya ? '500' : isGhana ? '50' : '2000',
  );
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [verifyHint, setVerifyHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const minBillAmount = isSouthAfrica ? 10 : isKenya ? 50 : isGhana ? 1 : 100;

  const billIdentifier = category === 'water' ? 'water-bill' : 'tv-subscription';

  const servicesQuery = useVtpassServices(
    billIdentifier,
    !countryLoading && live,
  );
  const services = servicesQuery.data ?? [];
  const loadingServices =
    countryLoading || (servicesQuery.isLoading && !servicesQuery.data);

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedVariation = variations.find(
    (v) => v.variationCode === variationCode,
  );

  const showAmountField = Boolean(
    selectedVariation && !selectedVariation.fixedPrice,
  );

  const amountNumber = useMemo(() => {
    if (selectedVariation?.fixedPrice) return selectedVariation.amount;
    return Number(amount) || 0;
  }, [selectedVariation, amount]);

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
    ? 'DStv, GOtv, StarTimes & water'
    : isKenya
      ? 'DStv, GOtv, StarTimes & water'
      : isGhana
        ? 'DStv, GOtv, StarTimes & water'
        : 'DStv, GOtv & StarTimes';

  const pageTitle = category === 'water' ? 'Water Bills' : 'TV Bills';

  const customerLabel =
    category === 'water'
      ? 'Account number'
      : selectedService?.customerLabel || 'Smartcard / IUC';

  const canSubmit = useMemo(() => {
    const verifiedOk = !isNigeria || Boolean(customerName);
    return (
      Boolean(serviceID && variationCode && customerRef.trim().length >= 6) &&
      verifiedOk &&
      !verifying &&
      amountNumber >= minBillAmount &&
      !submitting &&
      live &&
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
    live,
    frozen,
    canAfford,
  ]);

  useEffect(() => {
    if (!hasWaterTab && category === 'water') setCategory('tv');
  }, [hasWaterTab, category]);

  useEffect(() => {
    if (isSouthAfrica) setAmount('100');
    else if (isKenya) setAmount('500');
    else if (isGhana) setAmount('50');
    else setAmount('2000');
    setServiceID('');
    setCustomerRef('');
    setCustomerName(null);
  }, [isSouthAfrica, isKenya, isGhana, countryCode, category]);

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
          : 'Failed to load providers',
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
          `${endpoints.services.variations}?serviceID=${encodeURIComponent(serviceID)}&identifier=${encodeURIComponent(billIdentifier)}`,
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
          setError(e instanceof Error ? e.message : 'Failed to load plans');
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceID, billIdentifier]);

  // Auto-verify smartcard when digits are long enough.
  useEffect(() => {
    if (!live || !serviceID || customerRef.trim().length < 6) {
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
            category: category === 'water' ? 'water' : 'tv',
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
  }, [live, serviceID, customerRef, variationCode, category]);

  async function onSubmit() {
    if (!canSubmit || !selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        amountFormatted?: string;
        transactionId?: string;
      }>(endpoints.services.billsPurchase, {
        serviceID,
        serviceName: selectedService.name,
        category: category === 'water' ? 'water' : 'tv',
        customerRef: customerRef.trim(),
        amount: amountNumber,
        variationCode,
        recipientName: customerName,
      });
      setReceipt(data.amountFormatted || money(amountNumber));
      setTransactionId(data.transactionId || null);
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
    setTransactionId(null);
  }

  if (!countryLoading && !live) {
    return (
      <Screen
        scroll
        header={
          <PageHeader
            title="TV Bills"
            subtitle="Cable subscriptions"
            showBack
          />
        }>
        <Animated.View entering={cardEntering(0)} style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <Ionicons name="tv-outline" size={28} color={Brand.orange} />
          </View>
          <Text style={styles.gateTitle}>
            {countryName || 'Your country'} TV bills coming next
          </Text>
          <Text style={styles.gateSub}>
            Cable TV payments for {countryName || 'this market'} will go live
            next. Airtime and data already work.
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
                    ? 'Verifying account…'
                    : 'Verify account to continue'
                  : amountNumber > 0 && !canAfford(amountNumber)
                    ? 'Insufficient balance'
                    : `Pay bill · ${money(amountNumber)}`}
          </Text>
        </Pressable>
        )
      }
      header={<PageHeader title={pageTitle} subtitle={subtitle} showBack />}>
      {success ? (
        <ServiceSuccess
          title="Bill paid!"
          subtitle={`${selectedService?.name || pageTitle} paid successfully.`}
          amountLabel="Amount charged"
          amount={receipt || money(amountNumber)}
          reference={transactionId}
          onDismiss={resetSuccess}
          tertiaryAction={{
            label: 'Pay another bill',
            onPress: resetSuccess,
            icon: 'plus',
          }}
        />
      ) : null}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="TV Bills"
      />

      {showFormSkeleton ? (
        <FormSkeleton />
      ) : success ? null : (
        <>
      {hasWaterTab ? (
        <View style={styles.tabRow}>
          {(
            [
              { id: 'tv' as const, label: 'TV', icon: 'tv-outline' as const },
              { id: 'water' as const, label: 'Water', icon: 'water-outline' as const },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setCategory(tab.id)}
              style={[styles.tabChip, category === tab.id && styles.tabChipActive]}>
              <Ionicons
                name={tab.icon}
                size={16}
                color={category === tab.id ? Brand.white : colors.mutedForeground}
              />
              <Text style={[styles.tabText, category === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Provider</Text>
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
          value={customerRef}
          onChangeText={(t) => {
            setCustomerRef(t);
            setCustomerName(null);
            setVerifyHint(null);
          }}
          placeholder={customerLabel}
          keyboardType="number-pad"
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
      </View>

      <View style={styles.section}>
        <SelectSheet
          label="Bouquet"
          title="Select bouquet"
          subtitle="Available subscription plans"
          hint="Tap to choose"
          value={variationCode}
          valueLabel={selectedVariation?.name}
          onChange={setVariationCode}
          loading={loadingPlans}
          emptyText="No plans available"
          fullScreen={false}
          options={variations.map((v) => ({
            id: v.variationCode,
            title: v.name,
            trailing: v.fixedPrice && v.amount > 0 ? money(v.amount) : undefined,
          }))}
        />

        {showAmountField ? (
          <View style={styles.amountBlock}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountWrap}>
              <Text style={styles.currencyPrefix}>{currencyPrefix}</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder={String(minBillAmount)}
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
                    <Text
                      style={[
                        styles.presetText,
                        active && styles.presetTextActive,
                      ]}>
                      {money(Number(preset))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <SummaryRow label="Provider" value={selectedService?.name ?? '—'} />
        <SummaryRow
          label={category === 'water' ? 'Account' : 'Smartcard'}
          value={customerRef || '—'}
        />
        <SummaryRow label="Plan" value={selectedVariation?.name ?? '—'} />
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
    tabRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    tabChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    tabChipActive: {
      backgroundColor: Brand.orange,
      borderColor: Brand.orange,
    },
    tabText: { fontSize: 14, fontWeight: '700', color: colors.mutedForeground },
    tabTextActive: { color: Brand.white },
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
    amountBlock: { gap: 12, marginTop: 4 },
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
