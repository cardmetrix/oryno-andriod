import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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

import { LucideGiftIcon } from '@/components/icons/lucide-gift-icon';
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
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney, formatServiceMoney } from '@/lib/format';
import {
  defaultIntlAirtimeAmount,
  intlAirtimeCurrencySymbol,
  intlAirtimeMinLocal,
  intlAirtimePresets,
} from '@/lib/intl-airtime';
import { airtimePresets, estimateAirtimeCashback } from '@/lib/telecom';

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
  const { countryCode, loading: countryLoading, displayFx } = useProfile();
  const { canAfford, canAffordNgn, frozen } = useWalletBalance();
  const invalidateWallet = useInvalidateWallet();
  const isNigeria = countryCode === 'NG';

  const [networkId, setNetworkId] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(() =>
    isNigeria ? '500' : defaultIntlAirtimeAmount(countryCode),
  );
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [retailCharge, setRetailCharge] = useState(0);
  const [productTypeId, setProductTypeId] = useState(1);

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
      domain: op.domain,
    }));
  }, [isNigeria, localNetworksQuery.data, operatorsQuery.data]);

  const loadingNetworks =
    countryLoading ||
    (isNigeria
      ? localNetworksQuery.isLoading && !localNetworksQuery.data
      : (productTypesQuery.isLoading && !productTypesQuery.data) ||
        (operatorsQuery.isLoading && !operatorsQuery.data));

  const selectedNetwork = networks.find((n) => n.serviceID === networkId);

  const localAmount = Number(amount) || 0;
  const minLocal = isNigeria ? 50 : intlAirtimeMinLocal(countryCode);
  const faceAmount = isNigeria
    ? localAmount
    : localAmount * (displayFx?.localToNgn ?? 1);
  const chargeAmount =
    isNigeria && retailCharge > 0 ? retailCharge : faceAmount;
  const cashback = estimateAirtimeCashback(faceAmount);
  const money = (n: number) =>
    formatServiceMoney(n, countryCode, displayFx?.ngnToLocal ?? 1);
  const amountLabel = isNigeria
    ? money(faceAmount)
    : formatCountryMoney(localAmount, countryCode);
  const amountPresets = isNigeria ? airtimePresets : intlAirtimePresets(countryCode);
  const currencyPrefix = intlAirtimeCurrencySymbol(countryCode);
  const affordable = isNigeria ? canAfford(chargeAmount) : canAffordNgn(chargeAmount);

  useEffect(() => {
    if (countryLoading) return;
    setAmount(isNigeria ? '500' : defaultIntlAirtimeAmount(countryCode));
  }, [countryLoading, isNigeria, countryCode]);

  useEffect(() => {
    if (!isNigeria || !networkId || localAmount < minLocal) {
      setRetailCharge(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await api.get<{ retail?: number }>(
            `${endpoints.vtpass.quote}?serviceID=${encodeURIComponent(networkId)}&amount=${localAmount}`,
          );
          if (!cancelled && typeof data.retail === 'number') {
            setRetailCharge(data.retail);
          }
        } catch {
          if (!cancelled) setRetailCharge(0);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isNigeria, networkId, localAmount, minLocal]);

  const canSubmit = useMemo(() => {
    const digits = phone.replace(/\D/g, '').length >= 10;
    if (!digits || submitting || !networkId || frozen || !affordable) return false;
    return localAmount >= minLocal;
  }, [phone, submitting, networkId, frozen, affordable, localAmount, minLocal]);

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
              amount: localAmount,
              saveBeneficiary,
            }
          : {
              mode: 'international',
              phone,
              amount: localAmount,
              operatorId: networkId,
              countryIso: countryCode,
              productTypeId,
              saveBeneficiary,
              flexibleLocalAmount: true,
            },
      );
      setReceiptAmount(data.amountFormatted || amountLabel);
      setWalletLabel(data.wallet?.balanceFormatted ?? null);
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
                  : `Buy airtime · ${
                      isNigeria && retailCharge > 0
                        ? money(retailCharge)
                        : amountLabel
                    }`}
          </Text>
        </Pressable>
      }
      header={<PageHeader title="Buy Airtime" showBack />}>
      {success ? (
        <ServiceSuccess
          title="Airtime sent!"
          subtitle={`${receiptAmount || money(faceAmount)} sent to ${phone}${selectedNetwork ? ` · ${selectedNetwork.name}` : ''}`}
          amountLabel="Amount charged"
          amount={receiptAmount || money(faceAmount)}
          onDismiss={() => setSuccess(false)}
          tertiaryAction={{
            label: 'Buy again',
            onPress: () => setSuccess(false),
            icon: 'plus',
          }}>
          {isNigeria || walletLabel ? (
            <View style={styles.successExtras}>
              {isNigeria ? (
                <Text style={styles.cashbackAccent}>
                  Cashback: {money(cashback)}
                </Text>
              ) : null}
              {walletLabel ? (
                <Text style={styles.walletBal}>Wallet balance {walletLabel}</Text>
              ) : null}
            </View>
          ) : null}
        </ServiceSuccess>
      ) : null}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Buy Airtime"
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

      <Animated.View entering={cardEntering(80)} style={styles.section}>
        <Text style={styles.sectionTitle}>Select Amount</Text>
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
        <View style={styles.cashbackRow}>
          <LucideGiftIcon size={14} color={Brand.orange} strokeWidth={2} />
          <Text style={styles.cashbackHint}>Est. cashback {money(cashback)}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={cardEntering(100)} style={styles.summaryCard}>
        <SummaryRow label="Network" value={selectedNetwork?.name ?? '—'} />
        <SummaryRow label="Phone" value={phone || '—'} />
        <SummaryRow label="Airtime value" value={amountLabel} />
        {isNigeria && retailCharge > 0 && retailCharge !== localAmount ? (
          <SummaryRow label="You pay" value={money(retailCharge)} accent />
        ) : (
          <SummaryRow label="Amount" value={amountLabel} accent />
        )}
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
      width: '31%',
      flexGrow: 1,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    presetChipActive: {
      backgroundColor: Brand.orange,
    },
    presetText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    presetTextActive: { color: Brand.white },
    cashbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
    },
    cashbackHint: {
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
    successExtras: { alignItems: 'center', gap: 4 },
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
      color: colors.mutedForeground,
    },
  });
}
