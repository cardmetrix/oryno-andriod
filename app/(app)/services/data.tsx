import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { cardEntering } from '@/lib/motion';

import { DataPlanGrid } from '@/components/app/data-plan-grid';
import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { PhoneNumberField } from '@/components/app/phone-number-field';
import { ServiceSuccess } from '@/components/app/service-success';
import { TelecomNetworkGrid } from '@/components/app/telecom-network-grid';
import type { VtpassServiceOption } from '@/components/app/vtpass-service-picker';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import {
  useInternationalOperators,
  useInternationalProductTypes,
  useVtpassServices,
} from '@/hooks/use-service-catalogs';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { api } from '@/lib/api';
import {
  buildDataPlanFilters,
  planMatchesFilter,
} from '@/lib/data-plans';
import {
  readDataPlansCache,
  writeDataPlansCache,
} from '@/lib/data-plans-cache';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney, formatServiceMoney } from '@/lib/format';
import {
  defaultIntlDataAmount,
  intlDataCurrencySymbol,
  intlDataMinLocal,
  intlDataPresets,
  intlDataVariationLabel,
  usesFlexibleIntlData,
} from '@/lib/intl-data';
import {
  displayNgNetworkName,
  normalizeNgNetworkId,
} from '@/lib/telecom';

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice?: boolean;
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

export default function DataScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode, loading: countryLoading, displayFx } = useProfile();
  const { canAfford, canAffordNgn, frozen } = useWalletBalance();
  const invalidateWallet = useInvalidateWallet();
  const isNigeria = countryCode === 'NG';
  const isFlexibleIntl = usesFlexibleIntlData(countryCode);

  const [networkId, setNetworkId] = useState('');
  const [phone, setPhone] = useState('');
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [amount, setAmount] = useState(() => defaultIntlDataAmount(countryCode));
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState('');
  const [filter, setFilter] = useState('Weekly');
  const [productTypeId, setProductTypeId] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const [receiptLabel, setReceiptLabel] = useState('');
  const plansCacheRef = useRef<Map<string, Variation[]>>(new Map());

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
    if (isNigeria) {
      return (localNetworksQuery.data ?? []).map((s) => {
        const serviceID = normalizeNgNetworkId(s.serviceID);
        return {
          ...s,
          serviceID,
          name: displayNgNetworkName(s.serviceID, s.name),
          domain: s.domain || (serviceID === '9mobile' ? '9mobile.com.ng' : s.domain),
        };
      });
    }
    return (operatorsQuery.data ?? []).map((op) => ({
      serviceID: String(op.operator_id),
      name: cleanNetworkName(op.name),
      image: op.operator_image ?? null,
      domain: op.domain,
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
  const money = (n: number) =>
    formatServiceMoney(n, countryCode, displayFx?.ngnToLocal ?? 1);

  const availableFilters = useMemo(
    () => buildDataPlanFilters(variations.map((v) => v.name)),
    [variations],
  );

  const activeFilter =
    filter && availableFilters.includes(filter)
      ? filter
      : availableFilters[0] || 'Weekly';

  const filtered = useMemo(
    () => variations.filter((v) => planMatchesFilter(v.name, activeFilter)),
    [variations, activeFilter],
  );

  useEffect(() => {
    if (!availableFilters.length) return;
    if (!availableFilters.includes(filter)) {
      setFilter(availableFilters[0]);
    }
  }, [availableFilters, filter]);

  useEffect(() => {
    if (!filtered.length) {
      if (variationCode) setVariationCode('');
      return;
    }
    if (!filtered.some((v) => v.variationCode === variationCode)) {
      setVariationCode(filtered[0].variationCode);
    }
  }, [filtered, variationCode]);

  const localAmount = Number(amount) || 0;
  const minLocal = isFlexibleIntl ? intlDataMinLocal(countryCode) : 0;
  const chargeAmount = isNigeria
    ? selected?.amount || 0
    : isFlexibleIntl
      ? localAmount * (displayFx?.localToNgn ?? 1)
      : selected?.amount || 0;

  const affordable = isNigeria ? canAfford(chargeAmount) : canAffordNgn(chargeAmount);

  const canSubmit = useMemo(() => {
    if (phone.replace(/\D/g, '').length < 10 || submitting || !networkId) {
      return false;
    }
    if (frozen || !affordable) return false;
    if (isNigeria || !isFlexibleIntl) {
      return Boolean(selected && chargeAmount > 0);
    }
    return localAmount >= minLocal;
  }, [
    phone,
    submitting,
    networkId,
    frozen,
    affordable,
    isNigeria,
    isFlexibleIntl,
    selected,
    chargeAmount,
    localAmount,
    minLocal,
  ]);

  const amountLabel = isFlexibleIntl
    ? formatCountryMoney(localAmount, countryCode)
    : selected
      ? money(selected.amount)
      : money(0);
  const currencyPrefix = intlDataCurrencySymbol(countryCode);
  const amountPresets = isFlexibleIntl ? intlDataPresets(countryCode) : [];

  useEffect(() => {
    if (countryLoading) return;
    setAmount(defaultIntlDataAmount(countryCode));
  }, [countryLoading, countryCode]);

  useEffect(() => {
    // Keep AsyncStorage plan cache across remounts — only clear in-memory map.
    plansCacheRef.current.clear();
  }, [countryCode]);

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
    if (isFlexibleIntl || !networkId) return;
    let cancelled = false;

    (async () => {
      const cacheKey = isNigeria
        ? `ng:${networkId}`
        : `intl:${networkId}:${productTypeId}`;

      const memory = plansCacheRef.current.get(cacheKey);
      const session = memory?.length
        ? memory
        : await readDataPlansCache(cacheKey);
      if (cancelled) return;

      if (session?.length) {
        const hydrated = session.map((v) => ({
          ...v,
          amount: Number(v.amount) || 0,
          fixedPrice: Boolean(v.fixedPrice),
        }));
        plansCacheRef.current.set(cacheKey, hydrated);
        setVariations(hydrated);
        setVariationCode((prev) =>
          hydrated.some((v) => v.variationCode === prev)
            ? prev
            : hydrated[0]?.variationCode || '',
        );
        setLoadingPlans(false);
      } else {
        setLoadingPlans(true);
        setVariationCode('');
        setVariations([]);
      }

      try {
        const url = isNigeria
          ? `${endpoints.services.variations}?serviceID=${encodeURIComponent(networkId)}&identifier=data`
          : `${endpoints.services.variations}?serviceID=foreign-airtime&operator_id=${encodeURIComponent(networkId)}&product_type_id=${productTypeId}`;
        const data = await api.get<{ variations?: Variation[] }>(url);
        if (cancelled) return;
        const next = (data.variations ?? []).map((v) => ({
          ...v,
          amount: Number(v.amount) || 0,
          fixedPrice: Boolean(v.fixedPrice),
        }));
        plansCacheRef.current.set(cacheKey, next);
        void writeDataPlansCache(cacheKey, next);
        setVariations(next);
        if (next[0]?.variationCode) {
          setVariationCode((prev) =>
            next.some((v) => v.variationCode === prev)
              ? prev
              : next[0].variationCode,
          );
        }
      } catch (e) {
        if (!cancelled && !session?.length) {
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
  }, [isFlexibleIntl, isNigeria, networkId, productTypeId]);

  // Prefetch sibling network catalogs after the active one is ready (NG).
  useEffect(() => {
    if (!isNigeria || networks.length < 2 || !networkId || loadingPlans) return;
    if (!variations.length) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        for (const net of networks) {
          if (cancelled) return;
          if (net.serviceID === networkId) continue;
          const key = `ng:${net.serviceID}`;
          if (plansCacheRef.current.get(key)?.length) continue;
          const cached = await readDataPlansCache(key);
          if (cancelled) return;
          if (cached?.length) {
            plansCacheRef.current.set(
              key,
              cached.map((v) => ({
                ...v,
                amount: Number(v.amount) || 0,
                fixedPrice: Boolean(v.fixedPrice),
              })),
            );
            continue;
          }
          try {
            const data = await api.get<{ variations?: Variation[] }>(
              `${endpoints.services.variations}?serviceID=${encodeURIComponent(net.serviceID)}&identifier=data`,
            );
            if (cancelled) return;
            const next = (data.variations ?? []).map((v) => ({
              ...v,
              amount: Number(v.amount) || 0,
              fixedPrice: Boolean(v.fixedPrice),
            }));
            if (!next.length) continue;
            plansCacheRef.current.set(key, next);
            void writeDataPlansCache(key, next);
          } catch {
            // Prefetch is best-effort.
          }
        }
      })();
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isNigeria, networks, networkId, loadingPlans, variations.length]);

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const planLabel = isFlexibleIntl
        ? intlDataVariationLabel(countryCode, localAmount)
        : selected!.name;

      const data = await api.post<{ amountFormatted?: string; message?: string }>(
        endpoints.services.dataPurchase,
        isNigeria
          ? {
              mode: 'local',
              serviceID: networkId,
              phone,
              variationCode: selected!.variationCode,
              variationName: selected!.name,
              amount: selected!.amount,
              saveBeneficiary,
            }
          : isFlexibleIntl
            ? {
                mode: 'international',
                phone,
                amount: localAmount,
                operatorId: networkId,
                countryIso: countryCode,
                productTypeId,
                flexibleLocalAmount: true,
                saveBeneficiary,
              }
            : {
                mode: 'international',
                phone,
                variationCode: selected!.variationCode,
                variationName: selected!.name,
                amount: selected!.amount,
                operatorId: networkId,
                countryIso: countryCode,
                productTypeId,
                saveBeneficiary,
              },
      );
      setReceipt(data.amountFormatted || amountLabel);
      setReceiptLabel(planLabel);
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
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
              ? 'Processing…'
              : frozen
                ? 'Wallet unavailable'
                : !affordable && chargeAmount > 0
                  ? 'Insufficient balance'
                  : isFlexibleIntl || selected
                    ? `Buy data · ${amountLabel}`
                    : 'Select a plan'}
          </Text>
        </Pressable>
      }
      header={<PageHeader title="Buy Data" showBack />}>
      {success ? (
        <ServiceSuccess
          title="Data sent!"
          subtitle={`${receiptLabel || selected?.name || 'Data'} delivered to ${phone}`}
          amountLabel="Amount charged"
          amount={receipt || amountLabel}
          onDismiss={() => setSuccess(false)}
          secondaryAction={{
            label: 'Back to Home',
            onPress: () => router.replace('/(app)/(tabs)'),
            icon: 'home',
          }}
          tertiaryAction={{
            label: 'Buy again',
            onPress: () => setSuccess(false),
            icon: 'plus',
          }}
        />
      ) : null}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Buy Data"
      />

      <Animated.View entering={cardEntering(0)} style={styles.section}>
        <Text style={styles.sectionTitle}>Select Network</Text>
        <TelecomNetworkGrid
          services={networks}
          value={networkId}
          onChange={setNetworkId}
          loading={loadingNetworks || countryLoading}
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

      <Animated.View entering={cardEntering(40)} style={styles.section}>
        <PhoneNumberField
          value={phone}
          onChange={setPhone}
          placeholder={isNigeria ? '0803 000 0000' : 'Recipient number'}
        />
        <View style={styles.beneficiaryRow}>
          <Text style={styles.beneficiaryLabel}>Save as beneficiary</Text>
          <Switch
            value={saveBeneficiary}
            onValueChange={setSaveBeneficiary}
            trackColor={{ false: colors.border, true: Brand.orangeSoft }}
            thumbColor={saveBeneficiary ? Brand.orange : Brand.white}
          />
        </View>
      </Animated.View>

      {isFlexibleIntl ? (
        <Animated.View entering={cardEntering(80)} style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.currencyPrefix}>{currencyPrefix}</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={String(minLocal)}
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
                    {currencyPrefix}
                    {Number(preset).toLocaleString()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={cardEntering(80)} style={styles.section}>
          <DataPlanGrid
            plans={variations.map((v) => ({
              id: v.variationCode,
              name: v.name,
              amount: v.amount,
            }))}
            value={variationCode}
            onChange={setVariationCode}
            filter={activeFilter}
            onFilterChange={setFilter}
            formatMoney={money}
            loading={loadingPlans}
          />
        </Animated.View>
      )}

      <Animated.View entering={cardEntering(100)} style={styles.summaryCard}>
        <SummaryRow label="Network" value={selectedNetwork?.name ?? '—'} />
        {!isFlexibleIntl ? (
          <SummaryRow label="Plan" value={selected?.name ?? '—'} />
        ) : null}
        <SummaryRow label="Phone" value={phone || '—'} />
        <SummaryRow label="Amount" value={amountLabel} accent />
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
      <Text style={[styles.summaryValue, accent && styles.summaryAccent]} numberOfLines={2}>
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
    beneficiaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    beneficiaryLabel: {
      fontSize: 14,
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
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    presetChipActive: { backgroundColor: Brand.orange },
    presetText: {
      fontSize: 14,
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
  });
}
