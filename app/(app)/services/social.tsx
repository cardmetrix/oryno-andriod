import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ServiceInstructions } from '@/components/app/service-instructions';
import { ServiceSuccess } from '@/components/app/service-success';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useSocialCatalog } from '@/hooks/use-service-catalogs';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatUsd } from '@/lib/format';
import {
  formatConversionRate,
  formatLocalMoney,
  isCustomCommentsService,
  priceFor,
  QUANTITY_FLOOR,
  type BoostConversion,
  type JapServiceRow,
} from '@/lib/social-boost';

const QUALITY_ORDER = ['Premium', 'High Quality', 'Instant', 'Standard', 'Economy'];

function clampQty(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseQuantityInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

const EMPTY_COMMENTS_DRAFT = '1. ';

function parseNumberedComments(text: string): string[] {
  const comments: string[] = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^\d+\.\s?(.*)$/);
    if (match) {
      comments.push(match[1]);
    } else if (comments.length) {
      comments[comments.length - 1] = comments[comments.length - 1]
        ? `${comments[comments.length - 1]} ${line}`
        : line;
    } else if (line.trim()) {
      comments.push(line);
    }
  }
  return comments.length ? comments : [''];
}

function applyEnterCommentNumber(
  prev: string,
  next: string,
  maxQuantity: number,
): { text: string; cursor: number | null } {
  if (!next.trim()) {
    return { text: EMPTY_COMMENTS_DRAFT, cursor: EMPTY_COMMENTS_DRAFT.length };
  }

  const normalized = next.replace(/\r\n/g, '\n');
  const prevBreaks = (prev.match(/\n/g) || []).length;
  const nextBreaks = (normalized.match(/\n/g) || []).length;
  const needsFirstNumber = !/^\d+\.\s?/.test(normalized);

  if (nextBreaks <= prevBreaks && !needsFirstNumber) {
    return { text: normalized, cursor: null };
  }

  const lines = normalized.split('\n');
  const out: string[] = [];
  let numbered = 0;
  let cursor: number | null = null;

  for (const line of lines) {
    if (/^\d+\.\s?/.test(line)) {
      numbered += 1;
      if (numbered > maxQuantity) break;
      out.push(line);
      continue;
    }
    numbered += 1;
    if (numbered > maxQuantity) break;
    const prefix = `${numbered}. `;
    out.push(prefix + line);
    cursor = out.join('\n').length - line.length;
  }

  return { text: out.join('\n') || EMPTY_COMMENTS_DRAFT, cursor };
}

export default function SocialScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const invalidateWallet = useInvalidateWallet();
  const { canAffordUsd, usdBalance, loading: walletLoading, frozen } =
    useWalletBalance();
  const catalogQuery = useSocialCatalog();
  const [platform, setPlatform] = useState('');
  const [metric, setMetric] = useState('');
  const [quality, setQuality] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantityText, setQuantityText] = useState('');
  const [commentsDraft, setCommentsDraft] = useState(EMPTY_COMMENTS_DRAFT);
  const [commentSelection, setCommentSelection] = useState({
    start: EMPTY_COMMENTS_DRAFT.length,
    end: EMPTY_COMMENTS_DRAFT.length,
  });
  const [profileUrl, setProfileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [receipt, setReceipt] = useState('');
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const catalogData = catalogQuery.data;
  const conversion: BoostConversion | null = useMemo(() => {
    const c = catalogData?.conversion;
    return c && c.perUsd > 0 ? c : null;
  }, [catalogData?.conversion]);
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
    if (!catalogQuery.data) return;

    if (catalogData?.demo) {
      setError(
        'Social boosting is not available right now. Please try again later.',
      );
    } else if (catalogData?.fallback) {
      setError(
        'Live boost catalog timed out — showing limited packages. Refresh before ordering.',
      );
    } else if (!services.length && !catalogQuery.isLoading) {
      setError('No boost packages available right now. Try again shortly.');
    } else if (!catalogData?.demo && !catalogData?.fallback) {
      // Clear catalog-only errors once live data is healthy.
      setError((prev) =>
        prev?.includes('not live') ||
        prev?.includes('timed out') ||
        prev?.includes('No boost packages')
          ? null
          : prev,
      );
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
    setCommentsDraft(EMPTY_COMMENTS_DRAFT);
  }, [
    catalogQuery.dataUpdatedAt,
    catalogQuery.error,
    catalogQuery.isLoading,
    catalogQuery.data,
    catalogData?.demo,
    catalogData?.fallback,
    services,
    platforms,
  ]);

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
  const customComments = useMemo(
    () => parseNumberedComments(commentsDraft),
    [commentsDraft],
  );
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

  const money = (n: number) => formatUsd(n);

  const quantityHint = useMemo(() => {
    if (!selected) return 'Choose a package first';
    if (isCustomComments) {
      if (!filledComments.length) {
        return `Add ${minQuantity.toLocaleString()}–${maxQuantity.toLocaleString()} custom comments`;
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
  ]);

  const canSubmit = useMemo(() => {
    if (!liveMode) return false;
    if (!selected || submitting || frozen || !quantityValid || quantity == null) {
      return false;
    }
    if (amount > 0 && !canAffordUsd(amount)) return false;
    if (isCustomComments && filledComments.length !== quantity) return false;
    const link = profileUrl.trim();
    return link.length > 4 && /^(https?:\/\/|@|t\.me\/)/i.test(link);
  }, [
    liveMode,
    selected,
    submitting,
    frozen,
    canAffordUsd,
    amount,
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
      setCommentsDraft((prev) =>
        parseNumberedComments(prev).some((c) => c.trim()) ? prev : EMPTY_COMMENTS_DRAFT,
      );
      setQuantityText('');
      return;
    }
    setCommentsDraft(EMPTY_COMMENTS_DRAFT);
    setQuantityText((prev) => {
      const floor = Math.max(QUANTITY_FLOOR, selected.min);
      const n = parseQuantityInput(prev);
      if (n == null) return String(Math.min(selected.max, floor));
      if (n < floor || n > selected.max) return String(Math.min(selected.max, floor));
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
          endpoints.jap.status(orderId),
        );
        if (data.data?.status) {
          const label = String(data.data.status);
          setStatusLabel(label);
          const done = /^(completed|success|done|finished)$/i.test(label.trim());
          const failed = /cancel|refund|fail|reject/i.test(label);
          if (done || failed) {
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
    setCommentsDraft(EMPTY_COMMENTS_DRAFT);
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
    setCommentsDraft(EMPTY_COMMENTS_DRAFT);
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
    setCommentsDraft(EMPTY_COMMENTS_DRAFT);
  }

  function onPackageChange(serviceId: string) {
    setSelectedId(Number(serviceId));
    setQuantityText('');
    setCommentsDraft(EMPTY_COMMENTS_DRAFT);
  }

  function onCommentsDraftChange(value: string) {
    const { text, cursor } = applyEnterCommentNumber(
      commentsDraft,
      value,
      maxQuantity,
    );
    setCommentsDraft(text);
    if (cursor != null) {
      setCommentSelection({ start: cursor, end: cursor });
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const data = await api.post<{
        orderId?: string;
        transactionId?: string;
        amountFormatted?: string;
        simulated?: boolean;
        message?: string;
      }>(
        endpoints.jap.purchase,
        {
          serviceId: selected.service,
          serviceName: selected.name,
          platform: selected.platform,
          metric: selected.metric,
          link: profileUrl.trim(),
          quantity,
          rateUsd: selected.rate,
          priceLocal: amount,
          ...(isCustomComments ? { comments: filledComments } : {}),
        },
        { signal: controller.signal },
      );
      setOrderId(data.orderId || '');
      setTransactionId(data.transactionId || '');
      setReceipt(data.amountFormatted || money(amount));
      setStatusLabel(data.simulated ? 'Demo · In progress' : 'Pending');
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      setError(
        timedOut
          ? 'Boost order timed out. Check your history or try again.'
          : err instanceof Error
            ? err.message
            : 'Purchase failed',
      );
    } finally {
      clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  const submitLabel = submitting
    ? 'Processing…'
    : !liveMode
      ? 'Boosting unavailable'
      : frozen
        ? 'Wallet unavailable'
        : !walletLoading &&
            usdBalance != null &&
            amount > 0 &&
            !canAffordUsd(amount)
          ? 'Insufficient USD balance'
          : selected && quantityValid && quantity != null
            ? `Boost now · ${money(amount)}`
            : isCustomComments
              ? 'Add custom comments to continue'
              : 'Enter quantity to continue';

  const successVariant =
    statusLabel && /^(completed|success|done|finished)$/i.test(statusLabel.trim())
      ? 'success'
      : 'pending';

  const onPullRefresh = useCallback(async () => {
    await catalogQuery.refetch();
  }, [catalogQuery]);

  return (
    <Screen
      scroll
      refreshing={catalogQuery.isFetching && !catalogQuery.isLoading}
      onRefresh={() => void onPullRefresh()}
      footer={
        success ? null : (
          <Pressable
            disabled={!canSubmit}
            onPress={() => void onSubmit()}
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit && styles.submitDisabled,
              pressed && canSubmit && { opacity: 0.92 },
            ]}>
            <Text style={styles.submitText}>{submitLabel}</Text>
          </Pressable>
        )
      }
      header={
        <PageHeader
          title="Social Boosting"
          subtitle={
            liveMode
              ? 'Live boosts · billed in USD'
              : 'Grow followers, likes, views · billed in USD'
          }
          showBack
        />
      }>
      {success && selected ? (
        <ServiceSuccess
          variant={successVariant}
          title="Boost ordered!"
          subtitle={`${(quantity ?? 0).toLocaleString()} ${selected.metric.toLowerCase()} for ${selected.platform}`}
          amountLabel="Amount charged"
          amount={receipt || null}
          reference={orderId || null}
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
          secondaryAction={{
            label: 'Back to Home',
            onPress: () => router.replace('/(app)/(tabs)'),
            icon: 'home',
          }}
          tertiaryAction={{
            label: 'Boost again',
            onPress: () => {
              setSuccess(false);
              setStatusLabel(null);
              setOrderId('');
              setTransactionId('');
              setQuantityText('');
              setCommentsDraft(EMPTY_COMMENTS_DRAFT);
            },
            icon: 'plus',
          }}>
          {statusLabel ? (
            <View style={styles.statusRow}>
              {polling ? (
                <Ionicons name="refresh" size={14} color={Brand.orange} />
              ) : null}
              <Text style={styles.statusText}>Status: {statusLabel}</Text>
            </View>
          ) : null}
        </ServiceSuccess>
      ) : (
        <>
      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Social Boost"
      />

      {catalogData?.fallback && !error ? (
        <View style={styles.fallbackBanner}>
          <Text style={styles.fallbackText}>
            Live catalog is slow right now — showing backup packages.
          </Text>
        </View>
      ) : null}

      <Animated.View entering={cardEntering(0)} style={styles.card}>
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
            fullScreen={false}
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
            fullScreen={false}
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
            fullScreen={false}
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
            fullScreen={false}
            options={packagesForType.map((item) => ({
              id: String(item.service),
              title: item.name,
              trailing: `${money(item.samplePriceUsd ?? 0)}/${item.sampleQuantity.toLocaleString()}`,
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
              <Text style={styles.commentsHint}>
                Click enter to write your next comment
              </Text>
              <TextInput
                value={commentsDraft}
                onChangeText={onCommentsDraftChange}
                onSelectionChange={(e) => setCommentSelection(e.nativeEvent.selection)}
                selection={commentSelection}
                placeholder="1. Write your first comment"
                placeholderTextColor={colors.mutedForeground}
                multiline
                scrollEnabled
                blurOnSubmit={false}
                textAlignVertical="top"
                style={styles.commentsEditor}
              />
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

      <Animated.View entering={cardEntering(40)} style={styles.card}>
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

      <Animated.View entering={cardEntering(80)} style={styles.summaryCard}>
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
          <SummaryRow
            label="Conversion rate"
            value={
              conversion
                ? formatConversionRate(conversion.panelCurrency, conversion.panelPerUsd)
                : '—'
            }
          />
          {conversion &&
          conversion.currency !== conversion.panelCurrency &&
          conversion.currency !== 'USD' ? (
            <SummaryRow
              label={`${conversion.currency} rate`}
              value={formatConversionRate(conversion.currency, conversion.perUsd)}
            />
          ) : null}
          {conversion &&
          selected &&
          quantityValid &&
          quantity != null &&
          conversion.currency !== 'USD' ? (
            <SummaryRow
              label={`In ${conversion.currency}`}
              value={formatLocalMoney(amount * conversion.perUsd, conversion.currency)}
            />
          ) : null}
          <View style={styles.payRow}>
            <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
            <Text style={styles.payText}>Pay from USD card</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={cardEntering(120)}>
        <ServiceInstructions service="social" />
      </Animated.View>
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
      <Text style={[styles.summaryValue, accent && styles.summaryAccent]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginBottom: 12,
      borderRadius: Radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
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
      marginBottom: 6,
    },
    commentsCount: { fontSize: 12, fontWeight: '600', color: colors.grayMedium },
    commentsHint: {
      marginBottom: 8,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    commentsEditor: {
      minHeight: 140,
      maxHeight: 220,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
      lineHeight: 22,
    },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
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
    summaryCard: {
      marginBottom: 12,
      borderRadius: Radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
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
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusText: { fontSize: 14, fontWeight: '700', color: Brand.orange },
  });
}
