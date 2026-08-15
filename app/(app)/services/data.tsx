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
import { ServiceSuccess } from '@/components/app/service-success';
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

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice?: boolean;
};

const FILTERS = ['All', 'Daily', 'Weekly', 'Monthly'] as const;

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

function inferDataPlanCategory(name: string): 'daily' | 'weekly' | 'monthly' {
  const lower = name.toLowerCase();
  if (
    lower.includes('day') ||
    lower.includes('daily') ||
    lower.includes('24 hour') ||
    /\b1\s*day\b/.test(lower)
  ) {
    return 'daily';
  }
  if (lower.includes('week') || lower.includes('7 day') || lower.includes('7-day')) {
    return 'weekly';
  }
  return 'monthly';
}

export default function DataScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode, countryName, loading: countryLoading } = useProfile();
  const invalidateWallet = useInvalidateWallet();
  const isNigeria = countryCode === 'NG';

  const [networkId, setNetworkId] = useState('');
  const [phone, setPhone] = useState('');
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [productTypeId, setProductTypeId] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');

  const localNetworksQuery = useVtpassServices('data', !countryLoading && isNigeria);
  const productTypesQuery = useInternationalProductTypes(
    countryCode,
    !countryLoading && !isNigeria,
  );
  const dataProductTypeId = useMemo(() => {
    if (isNigeria) return null;
    const types = productTypesQuery.data ?? [];
    const dataType = types.find((t) => /data/i.test(t.name)) || types[0];
    return dataType?.product_type_id ?? null;
  }, [isNigeria, productTypesQuery.data]);
  const operatorsQuery = useInternationalOperators(
    countryCode,
    dataProductTypeId,
    !countryLoading && !isNigeria && dataProductTypeId != null,
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

  const selected = variations.find((v) => v.variationCode === variationCode);
  const selectedNetwork = networks.find((n) => n.serviceID === networkId);
  const money = (n: number) => formatCountryMoney(n, countryCode);

  const filtered = useMemo(() => {
    if (filter === 'All') return variations;
    return variations.filter((v) => inferDataPlanCategory(v.name) === filter.toLowerCase());
  }, [variations, filter]);

  const canSubmit = useMemo(() => {
    if (phone.replace(/\D/g, '').length < 10 || !selected || submitting) return false;
    return Boolean(networkId);
  }, [phone, selected, submitting, networkId]);

  useEffect(() => {
    if (dataProductTypeId != null) setProductTypeId(dataProductTypeId);
  }, [dataProductTypeId]);

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
    if (!networkId) return;
    let cancelled = false;

    (async () => {
      setLoadingPlans(true);
      setVariationCode('');
      try {
        const url = isNigeria
          ? `${endpoints.services.variations}?serviceID=${encodeURIComponent(networkId)}`
          : `${endpoints.services.variations}?serviceID=foreign-airtime&operator_id=${encodeURIComponent(networkId)}&product_type_id=${productTypeId}`;
        const data = await api.get<{ variations?: Variation[] }>(url);
        if (cancelled) return;
        const list = (data.variations ?? []).map((v) => ({
          ...v,
          amount: Number(v.amount) || 0,
        }));
        setVariations(list);
        if (list[0]?.variationCode) setVariationCode(list[0].variationCode);
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
  }, [isNigeria, networkId, productTypeId]);

  async function onSubmit() {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{ amountFormatted?: string; message?: string }>(
        endpoints.services.dataPurchase,
        isNigeria
          ? {
              mode: 'local',
              serviceID: networkId,
              phone,
              variationCode: selected.variationCode,
              variationName: selected.name,
              amount: selected.amount,
            }
          : {
              mode: 'international',
              phone,
              variationCode: selected.variationCode,
              variationName: selected.name,
              amount: selected.amount,
              operatorId: networkId,
              countryIso: countryCode,
              productTypeId,
            },
      );
      setReceipt(data.amountFormatted || money(selected.amount));
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (success && selected) {
    return (
      <Screen
        scroll
        header={<PageHeader title="Buy Data" subtitle="Daily, weekly & monthly plans" showBack />}>
        <ServiceSuccess
          title="Data sent"
          subtitle={`${selected.name} to ${phone}`}
          amountLabel="Amount charged"
          amount={receipt || money(selected.amount)}
          onDismiss={() => setSuccess(false)}
          tertiaryAction={{
            label: 'Buy again',
            onPress: () => setSuccess(false),
            icon: 'plus',
          }}
        />
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
              ? 'Buying data…'
              : selected
                ? `Buy data · ${money(selected.amount)}`
                : 'Select a plan'}
          </Text>
        </Pressable>
      }
      header={<PageHeader title="Buy Data" subtitle="Daily, weekly & monthly plans" showBack />}>
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
            <Ionicons name="wifi-outline" size={20} color={Brand.orange} />
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
          placeholder="0803 000 0000"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Data plan</Text>
        <SelectSheet
          label="Plan"
          title="Select data plan"
          subtitle="Daily, weekly & monthly bundles"
          hint="Tap to choose a plan"
          value={variationCode}
          valueLabel={selected?.name}
          onChange={setVariationCode}
          loading={loadingPlans}
          emptyText="No plans match this filter"
          options={filtered.map((v) => ({
            id: v.variationCode,
            title: v.name,
            subtitle: inferDataPlanCategory(v.name),
            trailing: money(v.amount),
          }))}
          headerExtra={
            <View style={styles.filters}>
              {FILTERS.map((f) => {
                const active = filter === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[styles.filterChip, active && styles.filterChipActive]}>
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
                  </Pressable>
                );
              })}
            </View>
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Network" value={selectedNetwork?.name ?? '—'} />
          <SummaryRow label="Plan" value={selected?.name ?? '—'} />
          <SummaryRow label="Phone" value={phone || '—'} />
          <SummaryRow
            label="Amount"
            value={selected ? money(selected.amount) : money(0)}
            accent
          />
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
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
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
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.charcoal,
    },
    plansHeader: { gap: 10, marginBottom: 8 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    filterChip: {
      borderRadius: 999,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    filterChipActive: { backgroundColor: Brand.orange },
    filterText: { fontSize: 12, fontWeight: '700', color: colors.charcoal },
    filterTextActive: { color: Brand.white },
    planList: { gap: 8 },
    planSkel: {
      height: 64,
      borderRadius: 16,
      backgroundColor: colors.grayLight,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    planRowActive: {
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
    },
    planName: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    planCat: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '600',
      color: colors.grayMedium,
      textTransform: 'capitalize',
    },
    planPrice: { fontSize: 14, fontWeight: '800', color: Brand.orange },
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
    emptyHint: {
      marginTop: 8,
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
      lineHeight: 20,
    },
    successActions: { marginTop: 12, width: '100%', gap: 10 },
  });
}
