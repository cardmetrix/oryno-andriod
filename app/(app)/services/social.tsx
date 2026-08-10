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
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import { useSocialCatalog } from '@/hooks/use-service-catalogs';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney } from '@/lib/format';

type JapServiceRow = {
  service: number;
  name: string;
  type: string;
  category: string;
  platform: string;
  metric: string;
  quality: string;
  rate: number;
  min: number;
  max: number;
  refill?: boolean;
  cancel?: boolean;
  currency: string;
  priceLocalPerThousand: number;
  sampleQuantity: number;
  samplePriceLocal: number;
};

const QUANTITY_FLOOR = 100;
const QUALITY_ORDER = ['Premium', 'High Quality', 'Instant', 'Standard', 'Economy'];

function clampQty(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function priceFor(service: JapServiceRow, quantity: number) {
  return (service.priceLocalPerThousand * quantity) / 1000;
}

function parseQuantityInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function isCustomCommentsService(service: {
  type?: string | null;
  quality?: string | null;
  name?: string | null;
}) {
  const hay = `${service.type || ''} ${service.quality || ''} ${service.name || ''}`
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  return /\bcustom\s*comments?\b/.test(hay);
}

export default function SocialScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode } = useProfile();
  const invalidateWallet = useInvalidateWallet();
  const catalogQuery = useSocialCatalog();
  const [platform, setPlatform] = useState('');
  const [metric, setMetric] = useState('');
  const [quality, setQuality] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantityText, setQuantityText] = useState('');
  const [customComments, setCustomComments] = useState<string[]>(['']);
  const [profileUrl, setProfileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [receipt, setReceipt] = useState('');
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const catalogData = catalogQuery.data as
    | {
        demo?: boolean;
        fallback?: boolean;
        platforms?: string[];
        services?: JapServiceRow[];
      }
    | undefined;
  const liveMode =
    catalogData?.demo === false && catalogData?.fallback !== true;
  const platforms = useMemo(
    () => (catalogData?.platforms ?? []).filter((p) => p && p !== 'All'),
    [catalogData?.platforms],
  );
  const services = useMemo(
    () =>
      (catalogData?.services ?? []).map((s) => ({
        ...s,
        quality: s.quality || 'Standard',
      })),
    [catalogData?.services],
  );
  const loading = catalogQuery.isLoading && !catalogQuery.data;

  useEffect(() => {
    if (catalogQuery.error) {
      setError(
        catalogQuery.error instanceof Error
          ? catalogQuery.error.message
          : 'Failed to load services',
      );
      return;
    }
    if (!services.length) return;

    const firstPlatform =
      platforms.find((p) => services.some((s) => s.platform === p)) ||
      platforms[0] ||
      '';
    const firstMetric =
      services.find((s) => s.platform === firstPlatform)?.metric ||
      services[0]?.metric ||
      '';
    const firstQuality =
      services.find(
        (s) => s.platform === firstPlatform && s.metric === firstMetric,
      )?.quality ||
      services[0]?.quality ||
      'Standard';
    const firstPkg =
      services.find(
        (s) =>
          s.platform === firstPlatform &&
          s.metric === firstMetric &&
          s.quality === firstQuality,
      ) ??
      services.find((s) => s.platform === firstPlatform && s.metric === firstMetric) ??
      services[0] ??
      null;

    setPlatform(firstPlatform);
    setMetric(firstMetric);
    setQuality(firstQuality);
    setSelectedId(firstPkg?.service ?? null);
    setQuantityText('');
    setCustomComments(['']);
    setError(null);
  }, [catalogQuery.dataUpdatedAt, catalogQuery.error, services, platforms]);

  const metrics = useMemo(() => {
    const set = new Set(
      services
        .filter((s) => !platform || s.platform === platform)
        .map((s) => s.metric)
        .filter(Boolean),
    );
    return Array.from(set);
  }, [services, platform]);

  const qualities = useMemo(() => {
    const set = new Set(
      services
        .filter(
          (s) =>
            (!platform || s.platform === platform) &&
            (!metric || s.metric === metric),
        )
        .map((s) => s.quality || 'Standard'),
    );
    return Array.from(set).sort((a, b) => {
      const ai = QUALITY_ORDER.indexOf(a);
      const bi = QUALITY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [services, platform, metric]);

  const packagesForType = useMemo(() => {
    return services.filter(
      (s) =>
        (!platform || s.platform === platform) &&
        (!metric || s.metric === metric) &&
        (!quality || (s.quality || 'Standard') === quality),
    );
  }, [services, platform, metric, quality]);

  const selected =
    packagesForType.find((s) => s.service === selectedId) ??
    packagesForType[0] ??
    null;

  const isCustomComments = selected ? isCustomCommentsService(selected) : false;
  const filledComments = useMemo(
    () => customComments.map((c) => c.trim()).filter(Boolean),
    [customComments],
  );

  const minQuantity = selected
    ? isCustomComments
      ? Math.max(1, selected.min)
      : Math.max(QUANTITY_FLOOR, selected.min)
    : QUANTITY_FLOOR;
  const maxQuantity = selected?.max ?? 1_000_000;
  const quantity = isCustomComments
    ? filledComments.length > 0
      ? filledComments.length
      : null
    : parseQuantityInput(quantityText);
  const quantityValid =
    quantity != null && quantity >= minQuantity && quantity <= maxQuantity;

  const amount =
    selected && quantityValid && quantity != null ? priceFor(selected, quantity) : 0;

  const money = (n: number) => formatCountryMoney(n, countryCode);

  const quantityHint = useMemo(() => {
    if (!selected) return 'Choose a package first';
    if (isCustomComments) {
      if (!filledComments.length) {
        return `Add ${minQuantity.toLocaleString()}–${maxQuantity.toLocaleString()} custom comments (one per row)`;
      }
      if (!quantityValid) {
        if (filledComments.length < minQuantity) {
          return `Add at least ${minQuantity.toLocaleString()} comments`;
        }
        return `Maximum is ${maxQuantity.toLocaleString()} comments`;
      }
      return `${filledComments.length.toLocaleString()} comments · ${money(priceFor(selected, filledComments.length))}`;
    }
    if (!quantityText.trim()) {
      return `Enter any amount from ${minQuantity.toLocaleString()}–${maxQuantity.toLocaleString()}`;
    }
    if (quantity == null) return 'Enter a valid whole number';
    if (quantity < minQuantity) return `Minimum is ${minQuantity.toLocaleString()}`;
    if (quantity > maxQuantity) return `Maximum is ${maxQuantity.toLocaleString()}`;
    return `${quantity.toLocaleString()} ${selected.metric.toLowerCase()} · ${money(priceFor(selected, quantity))}`;
  }, [
    selected,
    isCustomComments,
    filledComments.length,
    quantityValid,
    quantityText,
    quantity,
    minQuantity,
    maxQuantity,
    countryCode,
  ]);

  const canSubmit = useMemo(() => {
    if (!selected || submitting || !quantityValid || quantity == null) return false;
    if (isCustomComments && filledComments.length !== quantity) return false;
    const link = profileUrl.trim();
    return link.length > 4 && /^(https?:\/\/|@|t\.me\/)/i.test(link);
  }, [
    selected,
    submitting,
    quantityValid,
    quantity,
    isCustomComments,
    filledComments.length,
    profileUrl,
  ]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.service);
    if (isCustomCommentsService(selected)) {
      setCustomComments((prev) => {
        if (prev.some((c) => c.trim())) return prev;
        return [''];
      });
      setQuantityText('');
      return;
    }
    setCustomComments(['']);
    setQuantityText((prev) => {
      const n = parseQuantityInput(prev);
      if (n == null) return prev;
      if (n < Math.max(QUANTITY_FLOOR, selected.min) || n > selected.max) return '';
      return prev;
    });
  }, [selected]);

  useEffect(() => {
    if (!platform || !metrics.length) return;
    if (!metrics.includes(metric)) setMetric(metrics[0]);
  }, [platform, metrics, metric]);

  useEffect(() => {
    if (!qualities.length) return;
    if (!qualities.includes(quality)) setQuality(qualities[0]);
  }, [qualities, quality]);

  useEffect(() => {
    if (!success || !orderId || orderId.startsWith('demo_')) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled || tries > 24) return;
      tries += 1;
      setPolling(true);
      try {
        const data = await api.get<{ data?: { status?: string } }>(
          endpoints.services.socialStatus(orderId),
        );
        if (data.data?.status) {
          setStatusLabel(String(data.data.status));
          const done = /completed|partial|canceled|cancelled|refunded/i.test(
            String(data.data.status),
          );
          if (done) {
            setPolling(false);
            return;
          }
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
  }, [success, orderId]);

  function onPlatformChange(next: string) {
    setPlatform(next);
    const nextMetrics = Array.from(
      new Set(
        services
          .filter((s) => s.platform === next)
          .map((s) => s.metric)
          .filter(Boolean),
      ),
    );
    const nextMetric = nextMetrics[0] || '';
    setMetric(nextMetric);
    const nextQualities = Array.from(
      new Set(
        services
          .filter((s) => s.platform === next && s.metric === nextMetric)
          .map((s) => s.quality || 'Standard'),
      ),
    );
    const nextQuality = nextQualities[0] || '';
    setQuality(nextQuality);
    const match = services.find(
      (s) =>
        s.platform === next &&
        s.metric === nextMetric &&
        (s.quality || 'Standard') === nextQuality,
    );
    setSelectedId(match?.service ?? null);
    setQuantityText('');
    setCustomComments(['']);
  }

  function onMetricChange(next: string) {
    setMetric(next);
    const nextQualities = Array.from(
      new Set(
        services
          .filter((s) => (!platform || s.platform === platform) && s.metric === next)
          .map((s) => s.quality || 'Standard'),
      ),
    );
    const nextQuality = nextQualities[0] || '';
    setQuality(nextQuality);
    const match = services.find(
      (s) =>
        (!platform || s.platform === platform) &&
        s.metric === next &&
        (s.quality || 'Standard') === nextQuality,
    );
    setSelectedId(match?.service ?? null);
    setQuantityText('');
    setCustomComments(['']);
  }

  function onQualityChange(next: string) {
    setQuality(next);
    const match = services.find(
      (s) =>
        (!platform || s.platform === platform) &&
        (!metric || s.metric === metric) &&
        (s.quality || 'Standard') === next,
    );
    setSelectedId(match?.service ?? null);
    setQuantityText('');
    setCustomComments(['']);
  }

  function onPackageChange(serviceId: string) {
    setSelectedId(Number(serviceId));
    setQuantityText('');
    setCustomComments(['']);
  }

  function updateComment(index: number, value: string) {
    setCustomComments((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  function addCommentRow() {
    setCustomComments((prev) => {
      if (prev.length >= maxQuantity) return prev;
      return [...prev, ''];
    });
  }

  function removeCommentRow(index: number) {
    setCustomComments((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
  }

  function onQuantityTextChange(raw: string) {
    if (raw === '' || /^[\d,.\s]*$/.test(raw)) setQuantityText(raw);
  }

  function nudgeQuantity(delta: number) {
    if (!selected) return;
    const current = quantity ?? minQuantity;
    const next = clampQty(current + delta, minQuantity, maxQuantity);
    setQuantityText(String(next));
  }

  function commitQuantity() {
    if (!selected) return;
    const n = parseQuantityInput(quantityText);
    if (n == null) {
      setQuantityText('');
      return;
    }
    setQuantityText(String(clampQty(n, minQuantity, maxQuantity)));
  }

  async function onSubmit() {
    if (!canSubmit || !selected || quantity == null || !quantityValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        orderId?: string;
        amountFormatted?: string;
        simulated?: boolean;
        message?: string;
      }>(endpoints.services.socialPurchase, {
        serviceId: selected.service,
        serviceName: selected.name,
        platform: selected.platform,
        metric: selected.metric,
        link: profileUrl.trim(),
        quantity,
        rateUsd: selected.rate,
        priceLocal: amount,
        ...(isCustomComments ? { comments: filledComments } : {}),
      });
      setOrderId(data.orderId || '');
      setReceipt(data.amountFormatted || money(amount));
      setStatusLabel(data.simulated ? 'Demo · In progress' : 'Pending');
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = submitting
    ? 'Processing…'
    : selected && quantityValid && quantity != null
      ? `Boost now · ${money(amount)}`
      : isCustomComments
        ? 'Add custom comments to continue'
        : 'Enter quantity to continue';

  if (success && selected) {
    return (
      <Screen scroll>
        <PageHeader
          title="Social Boosting"
          subtitle={
            liveMode
              ? 'Live boosts · followers, likes, views'
              : 'Grow followers, likes, views'
          }
          showBack
        />
        <ServiceSuccess
          variant={polling ? 'pending' : 'success'}
          title="Boost ordered"
          subtitle={`${(quantity ?? 0).toLocaleString()} ${selected.metric.toLowerCase()} for ${selected.platform}`}
          amountLabel="Amount charged"
          amount={receipt || null}
          reference={orderId || null}
          onDismiss={() => setSuccess(false)}
          tertiaryAction={{
            label: 'Boost again',
            onPress: () => {
              setSuccess(false);
              setStatusLabel(null);
              setQuantityText('');
              setCustomComments(['']);
            },
            icon: 'plus',
          }}>
          {statusLabel ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>
                Status: {statusLabel}
                {polling ? '…' : ''}
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
            {submitting ? 'Processing…' : submitLabel}
          </Text>
        </Pressable>
      }>
      <PageHeader
        title="Social Boosting"
        subtitle={
          liveMode
            ? 'Live boosts · followers, likes, views'
            : 'Grow followers, likes, views'
        }
        showBack
      />

      {error ? (
        <View style={styles.errorBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable
            onPress={() => {
              setError(null);
              void catalogQuery.refetch();
            }}
            hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}

      {catalogData?.fallback && !error ? (
        <View style={styles.fallbackBanner}>
          <Text style={styles.fallbackText}>
            Live catalog is slow right now — showing backup packages.
          </Text>
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBubble}>
            <Ionicons name="trending-up-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Choose boost</Text>
            <Text style={styles.cardSub}>Platform, type, quality, then package</Text>
          </View>
        </View>

        <View style={styles.fields}>
          <SelectSheet
            label="Platform"
            title="Platform"
            subtitle="Choose where you want to boost"
            hint={loading ? 'Loading…' : 'Select platform'}
            value={platform}
            onChange={onPlatformChange}
            loading={loading}
            disabled={!platforms.length}
            options={platforms.map((item) => ({ id: item, title: item }))}
            emptyText="No platforms available"
          />

          <SelectSheet
            label="Type of service"
            title="Type of service"
            subtitle="Followers, likes, views, and more"
            hint={loading ? 'Loading…' : 'Select type'}
            value={metric}
            onChange={onMetricChange}
            loading={loading}
            disabled={!metrics.length}
            options={metrics.map((item) => ({ id: item, title: item }))}
            emptyText="No types for this platform"
          />

          <SelectSheet
            label="Quality type"
            title="Quality type"
            subtitle="Premium, high quality, economy, and more"
            hint={!metric ? 'Select a type first' : 'Select quality'}
            value={quality}
            onChange={onQualityChange}
            loading={loading}
            disabled={!qualities.length}
            options={qualities.map((item) => ({ id: item, title: item }))}
            emptyText="No quality options"
          />

          <SelectSheet
            label="Package"
            title="Package"
            subtitle="Pick a package for this boost type"
            hint={loading ? 'Loading…' : 'Select package'}
            value={selected ? String(selected.service) : ''}
            valueLabel={selected?.name}
            onChange={onPackageChange}
            loading={loading}
            disabled={!packagesForType.length}
            options={packagesForType.map((item) => ({
              id: String(item.service),
              title: item.name,
              trailing: `${money(item.samplePriceLocal)}/${item.sampleQuantity.toLocaleString()}`,
            }))}
            emptyText="No packages for this filter"
          />

          {!isCustomComments ? (
            <View>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <View style={styles.qtyRow}>
                <Pressable
                  disabled={!selected || (quantity ?? 0) <= minQuantity}
                  onPress={() => nudgeQuantity(-100)}
                  style={({ pressed }) => [
                    styles.qtyBtn,
                    (!selected || (quantity ?? 0) <= minQuantity) && { opacity: 0.4 },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <TextInput
                  value={quantityText}
                  onChangeText={onQuantityTextChange}
                  onBlur={commitQuantity}
                  editable={Boolean(selected)}
                  keyboardType="number-pad"
                  placeholder={`Min ${minQuantity.toLocaleString()}`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.qtyInput,
                    Boolean(quantityText.trim()) && !quantityValid && styles.qtyInputError,
                  ]}
                />
                <Pressable
                  disabled={!selected || (quantity ?? 0) >= maxQuantity}
                  onPress={() => nudgeQuantity(100)}
                  style={({ pressed }) => [
                    styles.qtyBtn,
                    (!selected || (quantity ?? 0) >= maxQuantity) && { opacity: 0.4 },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              <Text
                style={[
                  styles.qtyHint,
                  Boolean(quantityText.trim()) && !quantityValid && styles.qtyHintError,
                ]}>
                {quantityHint}
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.commentsHeader}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Custom comments</Text>
                <Text style={styles.commentsCount}>
                  {filledComments.length.toLocaleString()}/{maxQuantity.toLocaleString()}
                </Text>
              </View>
              <View style={styles.commentsList}>
                {customComments.map((comment, index) => (
                  <View key={`comment-${index}`} style={styles.commentRow}>
                    <Text style={styles.commentIndex}>{index + 1}</Text>
                    <TextInput
                      value={comment}
                      onChangeText={(value) => updateComment(index, value)}
                      placeholder={`Comment ${index + 1}`}
                      placeholderTextColor={colors.mutedForeground}
                      style={styles.commentInput}
                    />
                    <Pressable
                      disabled={customComments.length <= 1}
                      onPress={() => removeCommentRow(index)}
                      style={({ pressed }) => [
                        styles.commentRemoveBtn,
                        customComments.length <= 1 && { opacity: 0.4 },
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable
                disabled={customComments.length >= maxQuantity}
                onPress={addCommentRow}
                style={({ pressed }) => [
                  styles.addCommentBtn,
                  customComments.length >= maxQuantity && { opacity: 0.4 },
                  pressed && { opacity: 0.9 },
                ]}>
                <Ionicons name="add" size={18} color={colors.charcoal} />
                <Text style={styles.addCommentText}>Add more</Text>
              </Pressable>
              <Text
                style={[
                  styles.qtyHint,
                  filledComments.length > 0 && !quantityValid && styles.qtyHintError,
                ]}>
                {quantityHint}
              </Text>
            </View>
          )}

          {selected && quantityValid && quantity != null ? (
            <View style={styles.previewCard}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.previewName}>{selected.name}</Text>
                <Text style={styles.previewMeta}>
                  {quantity.toLocaleString()} {selected.metric.toLowerCase()}
                  {selected.refill ? ' · Refill available' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.previewPrice}>{money(amount)}</Text>
                <Text style={styles.previewTotal}>total</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.card}>
        <Text style={styles.fieldLabel}>Profile or post link</Text>
        <View style={styles.linkRow}>
          <Ionicons name="link-outline" size={20} color={colors.mutedForeground} />
          <TextInput
            value={profileUrl}
            onChangeText={setProfileUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://instagram.com/… or @username"
            placeholderTextColor={colors.mutedForeground}
            style={styles.linkInput}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Platform" value={selected?.platform ?? '—'} />
          <SummaryRow label="Type" value={selected?.metric ?? '—'} />
          <SummaryRow label="Quality" value={selected?.quality || quality || '—'} />
          <SummaryRow label="Package" value={selected?.name ?? '—'} />
          <SummaryRow
            label="Quantity"
            value={
              selected && quantityValid && quantity != null
                ? `${quantity.toLocaleString()} ${selected.metric}`
                : isCustomComments
                  ? 'Add comments'
                  : 'Enter quantity'
            }
          />
          <SummaryRow label="Target" value={profileUrl || '—'} />
          <SummaryRow
            label="Amount"
            value={selected && quantityValid && quantity != null ? money(amount) : '—'}
            accent
          />
          <View style={styles.payRow}>
            <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
            <Text style={styles.payText}>Pay from wallet</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(280)}>
        <ServiceInstructions service="social" />
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
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    iconBubble: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    cardSub: { marginTop: 2, fontSize: 13, fontWeight: '500', color: colors.grayMedium },
    fields: { gap: 12 },
    fieldLabel: {
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
    },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qtyBtn: {
      width: 48,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyBtnText: { fontSize: 22, fontWeight: '700', color: colors.charcoal, lineHeight: 24 },
    qtyInput: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '800',
      color: colors.charcoal,
    },
    qtyInputError: { borderColor: Brand.error },
    qtyHint: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    qtyHintError: { color: Brand.error, fontWeight: '600' },
    fallbackBanner: {
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,106,0,0.25)',
      backgroundColor: 'rgba(255,106,0,0.08)',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fallbackText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.charcoal,
      lineHeight: 17,
    },
    commentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    commentsCount: { fontSize: 12, fontWeight: '600', color: colors.grayMedium },
    commentsList: { gap: 8 },
    commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    commentIndex: {
      width: 22,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: colors.grayMedium,
    },
    commentInput: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
    },
    commentRemoveBtn: {
      width: 48,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCommentBtn: {
      marginTop: 10,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
    },
    addCommentText: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    previewName: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    previewMeta: { marginTop: 4, fontSize: 12, fontWeight: '500', color: colors.grayMedium },
    previewPrice: { fontSize: 14, fontWeight: '800', color: colors.charcoal },
    previewTotal: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '600',
      color: colors.grayMedium,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
    },
    linkInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.charcoal,
    },
    summary: { marginTop: 12, gap: 10 },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryLabel: { fontSize: 13, fontWeight: '500', color: colors.grayMedium },
    summaryValue: {
      maxWidth: '65%',
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
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusText: { fontSize: 14, fontWeight: '700', color: Brand.orange },
  });
}
