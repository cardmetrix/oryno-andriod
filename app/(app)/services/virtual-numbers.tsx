import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { PickerSheet } from '@/components/app/picker-sheet';
import { ServiceInstructions } from '@/components/app/service-instructions';
import { ServiceSuccess } from '@/components/app/service-success';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { useNumbersServices } from '@/hooks/use-service-catalogs';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatUsd } from '@/lib/format';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

type HeroService = { code: string; name: string };

type HeroOffer = {
  countryId: number;
  countrySlug?: string;
  countryName: string;
  iso: string | null;
  flagUrl: string | null;
  flagEmoji: string;
  service: string;
  serviceName: string;
  operator?: string;
  costUsd?: number;
  priceUsd: number;
  priceLocal: number;
  currency: string;
  count: number;
};

export default function VirtualNumbersScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const invalidateWallet = useInvalidateWallet();
  const { canAffordUsd, frozen } = useWalletBalance();
  const servicesQuery = useNumbersServices();
  const [service, setService] = useState('wa');
  const [countryOpen, setCountryOpen] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');
  const [countryQuery, setCountryQuery] = useState('');

  const [selected, setSelected] = useState<HeroOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activationId, setActivationId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [orderPending, setOrderPending] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const servicesData = servicesQuery.data as
    | { services?: HeroService[]; demo?: boolean }
    | undefined;
  const services = servicesData?.services ?? [];
  const loadingServices = servicesQuery.isLoading && !servicesQuery.data;

  const offersQuery = useQuery({
    queryKey: queryKeys.catalogs.numbersPrices(service),
    queryFn: async () => {
      const data = await api.get<{ offers?: HeroOffer[]; demo?: boolean }>(
        `${endpoints.services.numbersPrices}?service=${encodeURIComponent(service)}`,
      );
      return data;
    },
    enabled: Boolean(service),
    staleTime: STALE.catalog,
  });
  const offers = offersQuery.data?.offers ?? [];
  const loadingOffers = offersQuery.isLoading && !offersQuery.data;

  const money = (n: number) => formatUsd(n);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [services, serviceQuery]);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.countryName.toLowerCase().includes(q) ||
        (o.iso || '').toLowerCase().includes(q),
    );
  }, [offers, countryQuery]);

  useEffect(() => {
    if (!services.length) return;
    setService((prev) =>
      prev && services.some((s) => s.code === prev) ? prev : services[0].code,
    );
  }, [services]);

  useEffect(() => {
    setSelected(null);
    setCountryQuery('');
    setCountryOpen(false);
    if (offers[0]) setSelected(offers[0]);
  }, [offers]);

  useEffect(() => {
    if (servicesQuery.error) {
      setError(
        servicesQuery.error instanceof Error
          ? servicesQuery.error.message
          : 'Failed to load services',
      );
    } else if (offersQuery.error) {
      setError(
        offersQuery.error instanceof Error
          ? offersQuery.error.message
          : 'Failed to load prices',
      );
    }
  }, [servicesQuery.error, offersQuery.error]);

  useEffect(() => {
    if (!success || !activationId || smsCode || reversed) return;
    let cancelled = false;
    const started = Date.now();
    const maxMs = 60 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled) return;
      if (Date.now() - started > maxMs) {
        setPolling(false);
        return;
      }
      setPolling(true);
      try {
        const data = await api.get<{
          code?: string | null;
          refunded?: boolean;
          status?: string;
          error?: string;
          expiresAt?: string;
        }>(endpoints.services.numbersStatus(activationId));
        if (cancelled) return;
        if (data.code) {
          setSmsCode(data.code);
          setOrderPending(false);
          setPolling(false);
          return;
        }
        if (data.refunded || data.status === 'STATUS_CANCEL') {
          setReversed(true);
          setOrderPending(false);
          setPolling(false);
          toast.error(
            data.error ||
              'No SMS arrived in time. This purchase was reversed to your USD wallet.',
          );
          invalidateWallet();
          return;
        }
        if (typeof data.expiresAt === 'string') {
          setExpiresAt(data.expiresAt);
        }
      } catch {
        // keep polling
      }
      setPolling(false);
      if (!cancelled) timer = setTimeout(tick, 8000);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [success, activationId, smsCode, reversed, invalidateWallet]);

  const canBuyNumber = Boolean(
    selected && !submitting && !frozen && canAffordUsd(selected.priceUsd),
  );
  const buyLabel = submitting
    ? 'Getting number…'
    : frozen
      ? 'Wallet unavailable'
      : selected && !canAffordUsd(selected.priceUsd)
        ? 'Insufficient USD balance'
        : selected
          ? `Get number · ${money(selected.priceUsd)}`
          : 'Select a country';

  async function onSubmit() {
    if (!selected || submitting || !canBuyNumber) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        phoneNumber?: string;
        activationId?: string;
        transactionId?: string;
        amountFormatted?: string;
        expiresAt?: string;
      }>(endpoints.services.numbersPurchase, {
        heroCountryId: selected.countryId,
        countrySlug: selected.countrySlug,
        countryName: selected.countryName,
        iso: selected.iso,
        service: selected.service,
        serviceName: selected.serviceName,
        operator: selected.operator,
        costUsd: selected.costUsd ?? selected.priceUsd,
        priceUsd: selected.priceUsd,
        priceLocal: selected.priceLocal,
      });
      setPhoneNumber(data.phoneNumber || '');
      setActivationId(data.activationId || '');
      setTransactionId(data.transactionId || '');
      setReceipt(data.amountFormatted || money(selected.priceUsd));
      setSmsCode(null);
      setOrderPending(true);
      setReversed(false);
      setExpiresAt(data.expiresAt || null);
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyValue(value: string) {
    if (!value || value === '—' || value.includes('Waiting')) return;
    await Clipboard.setStringAsync(value);
  }

  let successModal: ReactNode = null;
  if (success) {
    const codeLabel = smsCode
      ? smsCode
      : reversed
        ? '—'
        : polling || orderPending
          ? 'Waiting for SMS…'
          : '—';
    const expiresHint = expiresAt
      ? ` · refunds after ${new Date(expiresAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : ' · auto-refund in 1 hour if no code';

    successModal = (
      <ServiceSuccess
        variant={reversed ? 'pending' : smsCode ? 'success' : 'pending'}
        title={
          reversed
            ? 'Purchase reversed'
            : smsCode
              ? 'Code received!'
              : 'Number ready — pending SMS'
        }
        subtitle={
          reversed
            ? 'No SMS arrived in time. Your USD wallet was refunded.'
            : smsCode
              ? 'Use this number and code for verification.'
              : 'Waiting for the OTP. If it doesn’t arrive within 1 hour, you’ll be refunded automatically.'
        }
        amountLabel="Amount charged"
        amount={receipt || null}
        onDismiss={() => setSuccess(false)}
        primaryAction={
          transactionId
            ? {
                label: 'View in History',
                onPress: () =>
                  router.push(`/(app)/history/${transactionId}` as never),
                icon: 'receipt',
              }
            : undefined
        }
        tertiaryAction={{
          label: 'Get another number',
          onPress: () => {
            setSuccess(false);
            setPhoneNumber('');
            setActivationId('');
            setTransactionId('');
            setSmsCode(null);
            setOrderPending(true);
            setReversed(false);
            setExpiresAt(null);
            setError(null);
          },
          icon: 'plus',
        }}>
        <View style={styles.copyStack}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text
              style={[
                styles.statusValue,
                reversed
                  ? { color: Brand.error }
                  : smsCode
                    ? { color: Brand.success }
                    : { color: Brand.orange },
              ]}>
              {reversed ? 'Reversed' : smsCode ? 'Completed' : 'Pending SMS'}
            </Text>
          </View>
          <CopyRow
            label="Phone number"
            value={phoneNumber}
            onCopy={() => void copyValue(phoneNumber)}
          />
          <CopyRow
            label="SMS code"
            value={codeLabel}
            muted={!smsCode}
            onCopy={() => void copyValue(codeLabel)}
          />
          {!smsCode && !reversed ? (
            <View style={styles.pollingRow}>
              <Ionicons name="refresh" size={14} color={colors.mutedForeground} />
              <Text style={styles.pollingText}>
                Waiting for the OTP{expiresHint}
              </Text>
            </View>
          ) : null}
        </View>
      </ServiceSuccess>
    );
  }

  const showFormSkeleton = !success && loadingServices;

  return (
    <Screen
      scroll
      footer={
        showFormSkeleton ? undefined : (
        <Button
          title={buyLabel}
          disabled={!canBuyNumber}
          loading={submitting}
          onPress={() => void onSubmit()}
        />
        )
      }
      header={
        <PageHeader
          title="Virtual Numbers"
          subtitle="Get verification numbers worldwide · billed in USD"
          showBack
        />
      }>
      {successModal}

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Virtual Numbers"
      />

      {showFormSkeleton ? (
        <FormSkeleton />
      ) : (
        <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBubble}>
            <Ionicons name="call-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Select service</Text>
            <Text style={styles.cardSub}>
              WhatsApp, Telegram, Google, Instagram & more
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={serviceQuery}
            onChangeText={setServiceQuery}
            placeholder="Search services (e.g. WhatsApp)"
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {filteredServices.length ? (
            filteredServices.map((s) => {
              const active = service === s.code;
              return (
                <Pressable
                  key={s.code}
                  onPress={() => setService(s.code)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.emptyInline}>
              No services match “{serviceQuery.trim()}”
            </Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Select country</Text>
        <Text style={styles.cardSub}>
          {loadingOffers
            ? 'Loading countries…'
            : `${offers.length} countries available`}
        </Text>

        {loadingOffers ? (
          <View style={styles.triggerSkel} />
        ) : (
          <Pressable
            disabled={!offers.length}
            onPress={() => {
              setCountryQuery('');
              setCountryOpen(true);
            }}
            style={({ pressed }) => [
              styles.countryTrigger,
              !offers.length && styles.triggerDisabled,
              pressed && offers.length ? { opacity: 0.92 } : null,
            ]}>
            {selected?.flagUrl ? (
              <Image
                source={{ uri: selected.flagUrl }}
                style={styles.flagImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={styles.flagEmoji}>
                {selected?.flagEmoji || '🌐'}
              </Text>
            )}
            <Text
              style={[
                styles.countryTriggerText,
                !selected && styles.countryTriggerPlaceholder,
              ]}
              numberOfLines={1}>
              {selected
                ? selected.countryName
                : offers.length
                  ? 'Select a country'
                  : 'No countries in stock'}
            </Text>
            {selected ? (
              <Text style={styles.countryPrice}>{money(selected.priceUsd)}</Text>
            ) : null}
            <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}

        {!loadingOffers && !offers.length ? (
          <Text style={styles.hint}>
            No countries in stock for this service. Try another service.
          </Text>
        ) : null}

      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Service" value={selected?.serviceName ?? '—'} />
          <SummaryRow
            label="Country"
            value={
              selected
                ? `${selected.flagEmoji || ''} ${selected.countryName}`.trim()
                : '—'
            }
          />
          <SummaryRow
            label="Amount"
            value={selected ? money(selected.priceUsd) : money(0)}
            accent
          />
          <View style={styles.walletRow}>
            <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
            <Text style={styles.walletText}>Pay from USD card</Text>
          </View>
        </View>
      </View>

      <ServiceInstructions service="virtual-numbers" />

      <PickerSheet
        visible={countryOpen}
        title="Select country"
        subtitle="Search and choose a country for your number"
        fullScreen={false}
        onClose={() => {
          setCountryOpen(false);
          setCountryQuery('');
        }}
        headerExtra={
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={countryQuery}
              onChangeText={setCountryQuery}
              placeholder="Search countries…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
          </View>
        }>
        {filteredCountries.length ? (
          <View style={styles.countryList}>
            {filteredCountries.map((offer) => {
              const active =
                selected?.countryId === offer.countryId &&
                selected?.service === offer.service;
              return (
                <Pressable
                  key={`${offer.countryId}-${offer.service}`}
                  onPress={() => {
                    setSelected(offer);
                    setCountryOpen(false);
                    setCountryQuery('');
                  }}
                  style={({ pressed }) => [
                    styles.countryRow,
                    active && styles.countryRowActive,
                    pressed && { opacity: 0.92 },
                  ]}>
                  {offer.flagUrl ? (
                    <Image
                      source={{ uri: offer.flagUrl }}
                      style={styles.flagImgLg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Text style={styles.flagEmojiLg}>{offer.flagEmoji || '🌐'}</Text>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.countryName} numberOfLines={1}>
                      {offer.countryName}
                    </Text>
                    <Text style={styles.countryMeta}>
                      {(offer.count ?? 0).toLocaleString()} available · SMS
                    </Text>
                  </View>
                  <Text style={styles.countryPrice}>{money(offer.priceUsd)}</Text>
                  {active ? (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={14} color={Brand.white} />
                    </View>
                  ) : (
                    <View style={styles.checkSpacer} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySheet}>
            <Text style={styles.emptyInline}>
              {countryQuery.trim()
                ? 'No countries match your search'
                : 'No countries available for this service'}
            </Text>
          </View>
        )}
      </PickerSheet>
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

function CopyRow({
  label,
  value,
  muted,
  onCopy,
}: {
  label: string;
  value: string;
  muted?: boolean;
  onCopy: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const canCopy = Boolean(value) && value !== '—' && !value.includes('Waiting');
  return (
    <View style={styles.copyRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text
          style={[styles.copyValue, muted && styles.copyMuted]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
      {canCopy ? (
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel={`Copy ${label}`}>
          <Ionicons name="copy-outline" size={16} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginBottom: 8,
      borderRadius: 22,
      backgroundColor: colors.card,
      padding: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    cardSub: {
      marginTop: 2,
      marginBottom: 12,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
      paddingVertical: 0,
    },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
    chipSkel: {
      width: 96,
      height: 36,
      borderRadius: 99,
      backgroundColor: colors.grayLight,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 99,
      backgroundColor: colors.grayLight,
    },
    chipActive: { backgroundColor: Brand.orange },
    chipText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
    chipTextActive: { color: Brand.white },
    emptyInline: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.grayMedium,
      paddingVertical: 8,
    },
    triggerSkel: {
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.grayLight,
    },
    countryTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    triggerDisabled: { opacity: 0.55 },
    countryTriggerText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.charcoal,
    },
    countryTriggerPlaceholder: { color: colors.grayMedium },
    countryPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: Brand.orange,
    },
    flagImg: { width: 28, height: 20, borderRadius: 4 },
    flagImgLg: { width: 36, height: 26, borderRadius: 5 },
    flagEmoji: { fontSize: 18 },
    flagEmojiLg: { fontSize: 22 },
    hint: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    summary: { gap: 10, marginTop: 4 },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    summaryLabel: { fontSize: 13, fontWeight: '500', color: colors.grayMedium },
    summaryValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '700',
      color: colors.charcoal,
    },
    summaryAccent: { color: Brand.orange },
    walletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.grayDivider,
    },
    walletText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
    countryList: { gap: 8 },
    countryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    countryRowActive: {
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
    },
    countryName: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    countryMeta: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSpacer: { width: 24, height: 24 },
    emptySheet: { paddingVertical: 28, alignItems: 'center' },
    copyStack: { width: '100%', gap: 10 },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    statusLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    statusValue: {
      fontSize: 12,
      fontWeight: '700',
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    copyLabel: { fontSize: 11, fontWeight: '600', color: colors.grayMedium },
    copyValue: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: '800',
      color: colors.charcoal,
    },
    copyMuted: { color: colors.grayMedium },
    copyBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pollingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pollingText: { fontSize: 12, fontWeight: '500', color: colors.grayMedium },
  });
}
