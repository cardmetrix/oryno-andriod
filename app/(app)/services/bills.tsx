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
import Animated, { FadeInDown } from 'react-native-reanimated';

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
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney } from '@/lib/format';

type BillCategory = 'tv' | 'electricity';

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const amountPresets = ['1000', '2000', '5000', '10000'];

export default function BillsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode, loading: countryLoading } = useProfile();
  const invalidateWallet = useInvalidateWallet();
  const isNigeria = countryCode === 'NG';

  const [category, setCategory] = useState<BillCategory>('tv');
  const [serviceID, setServiceID] = useState('');
  const [variationCode, setVariationCode] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [amount, setAmount] = useState('2000');
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const [retailAmount, setRetailAmount] = useState<number | null>(null);

  const identifier = category === 'tv' ? 'tv-subscription' : 'electricity-bill';
  const servicesQuery = useVtpassServices(identifier, !countryLoading && isNigeria);
  const services = servicesQuery.data ?? [];
  const loadingServices =
    countryLoading || (servicesQuery.isLoading && !servicesQuery.data);
  const variationsQuery = useVariations(serviceID, Boolean(serviceID) && isNigeria);
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

  const showAmountField =
    category === 'electricity' ||
    (Boolean(selectedVariation) && !selectedVariation?.fixedPrice);

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

  const money = (n: number) => formatCountryMoney(n, countryCode);

  const canSubmit = useMemo(() => {
    return (
      Boolean(serviceID && variationCode && customerRef.trim().length >= 6) &&
      amountNumber >= 100 &&
      !submitting &&
      isNigeria
    );
  }, [serviceID, variationCode, customerRef, amountNumber, submitting, isNigeria]);

  useEffect(() => {
    if (!showAmountField || !serviceID || !variationCode || faceAmount < 100) {
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
  }, [showAmountField, serviceID, variationCode, faceAmount]);

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

  async function verifyCustomer() {
    if (!serviceID || customerRef.trim().length < 6) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await api.post<{
        customerName?: string;
        renewalAmount?: number | string;
      }>(endpoints.services.billsVerify, {
        billersCode: customerRef.trim(),
        serviceID,
        type: category === 'electricity' ? variationCode : undefined,
      });
      setCustomerName(data.customerName || 'Verified customer');
      if (data.renewalAmount) {
        setAmount(String(Math.round(Number(data.renewalAmount))));
      }
    } catch (e) {
      setCustomerName(null);
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function onSubmit() {
    if (!canSubmit || !selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        amountFormatted?: string;
        token?: string;
        message?: string;
      }>(endpoints.services.billsPurchase, {
        serviceID,
        serviceName: selectedService.name,
        category,
        customerRef: customerRef.trim(),
        amount: showAmountField ? faceAmount : amountNumber,
        variationCode,
      });
      setReceipt(data.amountFormatted || money(amountNumber));
      setToken(data.token || null);
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!countryLoading && !isNigeria) {
    return (
      <Screen scroll>
        <PageHeader title="Bill Payments" subtitle="TV & electricity" showBack />
        <Animated.View entering={FadeInDown.duration(280)} style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <Ionicons name="flash-outline" size={28} color={Brand.orange} />
          </View>
          <Text style={styles.gateTitle}>Bill payments for Nigeria</Text>
          <Text style={styles.gateSub}>
            DSTV, GOtv, Startimes, Showmax and all electricity discos are available when
            your account country is Nigeria. Switch country in settings, or use
            international airtime/data for your market.
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
      <Screen scroll>
        <PageHeader
          title="Bill Payments"
          subtitle="TV subscriptions & electricity"
          showBack
        />
        <ServiceSuccess
          title="Bill paid"
          subtitle={
            selectedService?.name || 'Your bill was paid successfully.'
          }
          amountLabel="Amount charged"
          amount={receipt || money(amountNumber)}
          onDismiss={() => setSuccess(false)}
          tertiaryAction={{
            label: 'Pay another bill',
            onPress: () => {
              setSuccess(false);
              setToken(null);
            },
            icon: 'plus',
          }}>
          {token ? (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenText}>Token / receipt: {token}</Text>
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
            {submitting ? 'Paying bill…' : `Pay bill · ${money(amountNumber)}`}
          </Text>
        </Pressable>
      }>
      <PageHeader
        title="Bill Payments"
        subtitle="TV subscriptions & electricity"
        showBack
      />

      {error ? (
        <View style={styles.errorBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable onPress={() => setError(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
        <View style={styles.segment}>
          {(
            [
              { id: 'tv' as const, label: 'TV', icon: 'tv-outline' as const },
              {
                id: 'electricity' as const,
                label: 'Electricity',
                icon: 'flash-outline' as const,
              },
            ] as const
          ).map((tab) => {
            const active = category === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setCategory(tab.id)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={active ? Brand.orange : colors.mutedForeground}
                />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.card}>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>
          {category === 'tv' ? 'TV providers' : 'Electricity discos'}
        </Text>
        <VtpassServicePicker
          services={services}
          value={serviceID}
          onChange={setServiceID}
          loading={loadingServices || countryLoading}
          label="Provider"
          title={category === 'tv' ? 'Select TV provider' : 'Select electricity disco'}
          subtitle={category === 'tv' ? 'DSTV, GOtv, Startimes & more' : 'Discos across Nigeria'}
        />
        {error && !services.length ? (
          <Pressable
            style={styles.retryBtn}
            onPress={() => void servicesQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
        <Text style={styles.fieldLabel}>
          {category === 'tv' ? 'Smartcard number' : 'Meter number'}
        </Text>
        <View style={styles.verifyRow}>
          <TextInput
            value={customerRef}
            onChangeText={(t) => {
              setCustomerRef(t);
              setCustomerName(null);
            }}
            keyboardType="number-pad"
            placeholder={category === 'tv' ? 'Smartcard / IUC' : 'Meter number'}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable
            disabled={verifying || customerRef.trim().length < 6}
            onPress={() => void verifyCustomer()}
            style={({ pressed }) => [
              styles.verifyBtn,
              (verifying || customerRef.trim().length < 6) && { opacity: 0.5 },
              pressed && { opacity: 0.9 },
            ]}>
            {!verifying ? (
              <Ionicons name="search-outline" size={16} color={colors.foreground} />
            ) : null}
            <Text style={styles.verifyText}>{verifying ? 'Checking…' : 'Verify'}</Text>
          </Pressable>
        </View>
        {customerName ? (
          <Text style={styles.verifiedName}>{customerName}</Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.card}>
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
                      ₦{p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(280)} style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Provider" value={selectedService?.name ?? '—'} />
          <SummaryRow
            label={category === 'tv' ? 'Smartcard' : 'Meter'}
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
      borderWidth: 1,
      borderColor: colors.grayDivider,
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
    segment: {
      flexDirection: 'row',
      gap: 6,
      borderRadius: 14,
      backgroundColor: colors.grayLight,
      padding: 4,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      paddingVertical: 11,
    },
    segmentBtnActive: {
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    segmentText: { fontSize: 13, fontWeight: '700', color: colors.grayMedium },
    segmentTextActive: { color: Brand.orange },
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
    verifyRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    verifyBtn: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    verifyText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
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
    errorBanner: {
      marginBottom: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.25)',
      backgroundColor: 'rgba(255,59,48,0.08)',
      padding: 10,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    errorTitle: { fontSize: 13, fontWeight: '800', color: Brand.error },
    errorText: { marginTop: 2, fontSize: 12, fontWeight: '500', color: colors.charcoal },
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
