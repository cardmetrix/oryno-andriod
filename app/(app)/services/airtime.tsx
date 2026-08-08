import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { SelectSheet } from '@/components/app/picker-sheet';
import {
  VtpassServicePicker,
  type VtpassServiceOption,
} from '@/components/app/vtpass-service-picker';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import {
  useInternationalOperators,
  useInternationalProductTypes,
  useVtpassServices,
} from '@/hooks/use-service-catalogs';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney } from '@/lib/format';
import { airtimePresets, estimateAirtimeCashback } from '@/lib/telecom';

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

function cleanNetworkName(name: string) {
  return name
    .replace(/\bAirtime\b/gi, '')
    .replace(/\bVTU\b/gi, '')
    .replace(/\bData\b/gi, '')
    .replace(/\bPayment\b/gi, '')
    .replace(/\bSubscription\b/gi, '')
    .replace(/\bInternet\b/gi, '')
    .replace(/\b\(SME\)\b/gi, 'SME')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AirtimeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode, countryName, loading: countryLoading } = useProfile();
  const invalidateWallet = useInvalidateWallet();
  const isNigeria = countryCode === 'NG';

  const [networkId, setNetworkId] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('500');
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [retailAmount, setRetailAmount] = useState<number | null>(null);

  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationCode, setVariationCode] = useState('');
  const [productTypeId, setProductTypeId] = useState(1);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const localNetworksQuery = useVtpassServices('airtime', !countryLoading && isNigeria);
  const productTypesQuery = useInternationalProductTypes(
    countryCode,
    !countryLoading && !isNigeria,
  );
  const airtimeProductTypeId = useMemo(() => {
    if (isNigeria) return null;
    const types = productTypesQuery.data ?? [];
    const topUp =
      types.find((t) => /top\s*up|airtime/i.test(t.name)) || types[0];
    return topUp?.product_type_id ?? null;
  }, [isNigeria, productTypesQuery.data]);
  const operatorsQuery = useInternationalOperators(
    countryCode,
    airtimeProductTypeId,
    !countryLoading && !isNigeria && airtimeProductTypeId != null,
  );

  const networks: VtpassServiceOption[] = useMemo(() => {
    if (isNigeria) return localNetworksQuery.data ?? [];
    return (operatorsQuery.data ?? []).map((op) => ({
      serviceID: String(op.operator_id),
      name: cleanNetworkName(op.name),
      image: op.operator_image ?? null,
    }));
  }, [isNigeria, localNetworksQuery.data, operatorsQuery.data]);

  const loadingNetworks =
    countryLoading ||
    (isNigeria
      ? localNetworksQuery.isLoading && !localNetworksQuery.data
      : (productTypesQuery.isLoading && !productTypesQuery.data) ||
        (operatorsQuery.isLoading && !operatorsQuery.data));

  const selectedNetwork = networks.find((n) => n.serviceID === networkId);
  const selectedVariation = variations.find((v) => v.variationCode === variationCode);

  const faceAmount = isNigeria
    ? Number(amount) || 0
    : selectedVariation?.amount || 0;
  const amountNumber =
    isNigeria && retailAmount != null && retailAmount > 0 ? retailAmount : faceAmount;
  const cashback = estimateAirtimeCashback(amountNumber);
  const money = (n: number) => formatCountryMoney(n, countryCode);

  useEffect(() => {
    if (!isNigeria || !networkId || faceAmount < 50) {
      setRetailAmount(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await api.get<{ retail?: number }>(
            `${endpoints.vtpass.quote}?serviceID=${encodeURIComponent(networkId)}&amount=${faceAmount}`,
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
  }, [isNigeria, networkId, faceAmount]);

  const canSubmit = useMemo(() => {
    const digits = phone.replace(/\D/g, '').length >= 10;
    if (!digits || submitting || !networkId) return false;
    if (isNigeria) return amountNumber >= 50;
    return Boolean(variationCode && amountNumber > 0);
  }, [phone, submitting, networkId, isNigeria, amountNumber, variationCode]);

  useEffect(() => {
    if (airtimeProductTypeId != null) setProductTypeId(airtimeProductTypeId);
  }, [airtimeProductTypeId]);

  useEffect(() => {
    if (!networks.length) {
      setNetworkId('');
      return;
    }
    setNetworkId((prev) =>
      prev && networks.some((n) => n.serviceID === prev) ? prev : networks[0].serviceID,
    );
  }, [networks]);

  useEffect(() => {
    const catalogError =
      localNetworksQuery.error || productTypesQuery.error || operatorsQuery.error;
    if (catalogError) {
      setError(
        catalogError instanceof Error ? catalogError.message : 'Failed to load networks',
      );
    }
  }, [localNetworksQuery.error, productTypesQuery.error, operatorsQuery.error]);

  useEffect(() => {
    if (isNigeria || !networkId) return;
    let cancelled = false;

    (async () => {
      setLoadingPackages(true);
      setVariationCode('');
      try {
        const data = await api.get<{ variations?: Variation[] }>(
          `${endpoints.services.variations}?serviceID=foreign-airtime&operator_id=${encodeURIComponent(networkId)}&product_type_id=${productTypeId}`,
        );
        if (cancelled) return;
        const list = data.variations ?? [];
        setVariations(list);
        if (list[0]?.variationCode) setVariationCode(list[0].variationCode);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load packages');
        }
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNigeria, networkId, productTypeId]);

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        amountFormatted?: string;
        wallet?: { balanceFormatted?: string };
        message?: string;
      }>(
        endpoints.services.airtimePurchase,
        isNigeria
          ? {
              mode: 'local',
              serviceID: networkId,
              phone,
              amount: faceAmount,
              saveBeneficiary,
            }
          : {
              mode: 'international',
              phone,
              amount: faceAmount,
              operatorId: networkId,
              countryIso: countryCode,
              productTypeId,
              variationCode,
              saveBeneficiary,
            },
      );
      setReceiptAmount(data.amountFormatted || money(amountNumber));
      setWalletLabel(data.wallet?.balanceFormatted ?? null);
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Screen scroll>
        <PageHeader title="Buy Airtime" subtitle="Top up any network instantly" showBack />
        <Animated.View entering={FadeInDown.duration(280)} style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={28} color={Brand.success} />
          </View>
          <Text style={styles.successTitle}>Airtime sent</Text>
          <Text style={styles.successSub}>
            {receiptAmount || money(amountNumber)} sent to {phone}
            {selectedNetwork ? ` · ${selectedNetwork.name}` : ''}
          </Text>
          {isNigeria ? (
            <Text style={styles.cashbackAccent}>Cashback: {money(cashback)}</Text>
          ) : null}
          {walletLabel ? (
            <Text style={styles.walletBal}>Wallet balance {walletLabel}</Text>
          ) : null}
          <View style={styles.successActions}>
            <Button title="Buy again" onPress={() => setSuccess(false)} />
            <Button
              title="Back to Home"
              variant="secondary"
              onPress={() => router.replace('/(app)/(tabs)')}
            />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <PageHeader title="Buy Airtime" subtitle="Top up any network instantly" showBack />

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
        <View style={styles.cardHeader}>
          <View style={styles.iconBubble}>
            <Ionicons name="phone-portrait-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Select network</Text>
            <Text style={styles.cardSub}>Networks for {countryName}</Text>
          </View>
        </View>
        <VtpassServicePicker
          services={networks}
          value={networkId}
          onChange={setNetworkId}
          loading={loadingNetworks || countryLoading}
          subtitle={`Networks for ${countryName}`}
        />
        {error && !networks.length ? (
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              void localNetworksQuery.refetch();
              void productTypesQuery.refetch();
              void operatorsQuery.refetch();
            }}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.card}>
        <Text style={styles.fieldLabel}>Phone number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={isNigeria ? '0803 000 0000' : 'Recipient number'}
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />
        <View style={styles.beneficiaryRow}>
          <Text style={styles.beneficiaryLabel}>Save as beneficiary</Text>
          <Switch
            value={saveBeneficiary}
            onValueChange={setSaveBeneficiary}
            trackColor={{ false: colors.grayDivider, true: Brand.orangeSoft }}
            thumbColor={saveBeneficiary ? Brand.orange : Brand.white}
          />
        </View>
      </Animated.View>

      {isNigeria ? (
        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
          <Text style={styles.fieldLabel}>Amount</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.currencyPrefix}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              placeholder="500"
              placeholderTextColor={colors.mutedForeground}
              style={styles.amountInput}
            />
          </View>
          <View style={styles.presets}>
            {airtimePresets.map((preset) => {
              const active = amount === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setAmount(preset)}
                  style={[styles.presetChip, active && styles.presetChipActive]}>
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    ₦{preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.cashbackRow}>
            <Ionicons name="gift-outline" size={14} color={Brand.orange} />
            <Text style={styles.cashbackHint}>Est. cashback {money(cashback)}</Text>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Package</Text>
          <SelectSheet
            label="Package"
            title="Select package"
            subtitle="Airtime packages for this network"
            hint="Tap to choose a package"
            value={variationCode}
            onChange={setVariationCode}
            loading={loadingPackages}
            emptyText="No packages for this network"
            options={variations.map((v) => ({
              id: v.variationCode,
              title: v.name,
              trailing: money(v.amount),
            }))}
          />
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Network" value={selectedNetwork?.name ?? '—'} />
          <SummaryRow label="Phone" value={phone || '—'} />
          {isNigeria && retailAmount != null && retailAmount !== faceAmount ? (
            <SummaryRow label="Airtime value" value={money(faceAmount)} />
          ) : null}
          <SummaryRow label="You pay" value={money(amountNumber)} accent />
          <View style={styles.payRow}>
            <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
            <Text style={styles.payText}>Pay from wallet</Text>
          </View>
        </View>
      </Animated.View>


      <Animated.View entering={FadeInDown.delay(200).duration(280)} style={{ marginTop: 16, marginBottom: 8 }}>
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
              ? 'Buying airtime…'
              : `Buy airtime · ${money(amountNumber)}`}
          </Text>
        </Pressable>
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
      marginBottom: 14,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 18,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    cardSub: { marginTop: 2, fontSize: 12, fontWeight: '500', color: colors.grayMedium },
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
      paddingHorizontal: 16,
      fontSize: 14,
      color: colors.charcoal,
    },
    beneficiaryRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    beneficiaryLabel: { fontSize: 14, fontWeight: '500', color: colors.grayMedium },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      paddingHorizontal: 14,
    },
    currencyPrefix: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.grayMedium,
      marginRight: 6,
    },
    amountInput: { flex: 1, fontSize: 14, color: colors.charcoal, height: '100%' },
    presets: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    presetChip: {
      borderRadius: 999,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    presetChipActive: { backgroundColor: Brand.orange },
    presetText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
    presetTextActive: { color: Brand.white },
    cashbackRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cashbackHint: { fontSize: 12, fontWeight: '500', color: colors.grayMedium },
    packageList: { marginTop: 12, gap: 8 },
    packageSkel: {
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.grayLight,
    },
    packageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    packageRowActive: {
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
    },
    packageName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.charcoal },
    packagePrice: { fontSize: 14, fontWeight: '800', color: Brand.orange },
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
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
    emptyHint: {
      marginTop: 12,
      textAlign: 'center',
      fontSize: 13,
      color: colors.grayMedium,
      fontWeight: '500',
    },
    retryBtn: {
      marginTop: 12,
      alignSelf: 'center',
      backgroundColor: Brand.orange,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    errorBanner: {
      marginBottom: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.25)',
      backgroundColor: 'rgba(255,59,48,0.08)',
      padding: 14,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    errorTitle: { fontSize: 13, fontWeight: '800', color: Brand.error },
    errorText: { marginTop: 2, fontSize: 12, fontWeight: '500', color: colors.charcoal },
    successCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 28,
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
      marginTop: 16,
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
      lineHeight: 20,
    },
    cashbackAccent: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '700',
      color: Brand.orange,
    },
    walletBal: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    successActions: { marginTop: 24, width: '100%', gap: 10 },
  });
}
