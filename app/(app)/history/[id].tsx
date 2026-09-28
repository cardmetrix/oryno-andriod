import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import { PageHeader } from '@/components/app/page-header';
import {
  StatusMarkIcon,
  normalizeStatusMark,
} from '@/components/app/status-mark-icon';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';
import type { AppTransaction } from '@/lib/types';

type TransactionReceipt = AppTransaction & {
  amountRaw?: string;
  amountUnsigned?: string;
  balanceAfter?: string | null;
  balanceAfterFormatted?: string | null;
  externalRef?: string | null;
  reference: string;
  categoryLabel: string;
  statusRaw?: string;
  createdAtFormatted: string;
  metadata: Record<string, unknown> | null;
};

function metaString(meta: Record<string, unknown> | null, key: string) {
  const v = meta?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function isVirtualNumberTx(tx: TransactionReceipt) {
  return (
    tx.category === 'virtual_number' ||
    tx.category === 'numbers' ||
    Boolean(metaString(tx.metadata, 'activationId')) ||
    Boolean(metaString(tx.metadata, 'phoneNumber'))
  );
}

function isSocialBoostTx(tx: TransactionReceipt) {
  return (
    tx.category === 'social' ||
    metaString(tx.metadata, 'kind') === 'social_boost' ||
    Boolean(metaString(tx.metadata, 'japOrderId'))
  );
}

/** Receipts that render a live status panel (boost or number SMS). */
function hasLiveStatusSection(tx: TransactionReceipt) {
  if (isSocialBoostTx(tx)) {
    return Boolean(metaString(tx.metadata, 'japOrderId') || tx.externalRef);
  }
  if (isVirtualNumberTx(tx)) {
    return Boolean(
      metaString(tx.metadata, 'activationId') ||
        tx.externalRef ||
        metaString(tx.metadata, 'phoneNumber') ||
        metaString(tx.metadata, 'smsCode'),
    );
  }
  return false;
}

export default function HistoryDetailScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptRef = useRef<View>(null);
  const [tx, setTx] = useState<TransactionReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing transaction id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<{ transaction: TransactionReceipt }>(
        endpoints.transactions.detail(id),
      );
      setTx(json.transaction);
    } catch (e) {
      setTx(null);
      setError(e instanceof Error ? e.message : 'Transaction not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setReceiptOpen(false);
  }, [id]);

  function receiptText(receipt: TransactionReceipt) {
    const credit = receipt.type === 'credit';
    return [
      'ORYNO Transaction receipt',
      '',
      receipt.title,
      receipt.amount,
      `Status: ${normalizeStatusMark(receipt.status)}`,
      '',
      `Category: ${receipt.categoryLabel}`,
      `Details: ${receipt.subtitle}`,
      `Type: ${credit ? 'Credit' : 'Debit'}`,
      `Date: ${receipt.createdAtFormatted}`,
      `Reference: ${receipt.reference}`,
      `Currency: ${receipt.currency ?? 'NGN'}`,
      '',
      'Powered by ORYNO · Keep this receipt for your records',
    ].join('\n');
  }

  async function captureReceiptUri(): Promise<string> {
    // Wait for layout/paint so view-shot doesn't capture a zero-size view.
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    const raw = await captureRef(receiptRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      // Android can undersize without an explicit scale.
      ...(Platform.OS === 'android' ? { handle: undefined } : null),
    });

    let uri = typeof raw === 'string' ? raw : String(raw);
    if (!uri) throw new Error('Could not capture receipt');
    if (!uri.startsWith('file://')) uri = `file://${uri}`;

    // Share/save flows need a local file:// URI with an extension.
    const safeRef = (tx?.reference || 'receipt').replace(/[^\w.-]+/g, '_');
    const dest = `${FileSystem.cacheDirectory}oryno-receipt-${safeRef}.png`;
    try {
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {
      // ignore
    }
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }

  async function onShare() {
    if (!tx) return;
    setSharing(true);
    try {
      const uri = await captureReceiptUri();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'ORYNO Receipt',
          UTI: 'public.png',
        });
        return;
      }
      await Share.share({
        title: 'ORYNO Receipt',
        message: receiptText(tx),
        url: uri,
      });
    } catch (e) {
      if (e instanceof Error && /user did not share|share.*cancel|abort/i.test(e.message)) {
        return;
      }
      alert.error(
        'Error',
        e instanceof Error ? e.message : 'Couldn’t share receipt',
      );
    } finally {
      setSharing(false);
    }
  }

  async function onDownload() {
    if (!tx) return;
    setDownloading(true);
    try {
      const uri = await captureReceiptUri();

      // System share sheet (Save image / Photos / Files) — no broad storage permissions.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Save ORYNO Receipt',
          UTI: 'public.png',
        });
        return;
      }

      throw new Error('Couldn’t save the receipt image.');
    } catch (e) {
      if (e instanceof Error && /user did not share|share.*cancel|abort/i.test(e.message)) {
        return;
      }
      alert.error(
        'Download failed',
        e instanceof Error ? e.message : 'Couldn’t download receipt',
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <Screen
        header={<PageHeader title="Receipt" subtitle="Transaction details" showBack />}>
        <ReceiptSkeleton />
      </Screen>
    );
  }

  if (!tx || error) {
    return (
      <Screen
        header={<PageHeader title="Receipt" subtitle="Transaction details" showBack />}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Receipt unavailable</Text>
          <Text style={styles.errorSub}>
            {error ?? 'This transaction could not be found.'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const credit = tx.type === 'credit';
  const hasStatusSection = hasLiveStatusSection(tx);
  const showReceipt = !hasStatusSection || receiptOpen;

  return (
    <Screen
      scroll
      header={<PageHeader title="Receipt" subtitle="Transaction details" showBack />}>
      {isVirtualNumberTx(tx) ? (
        <Animated.View entering={FadeInDown.duration(280)}>
          <VirtualNumberCodePanel tx={tx} />
        </Animated.View>
      ) : null}

      {isSocialBoostTx(tx) ? (
        <Animated.View
          entering={FadeInDown.delay(isVirtualNumberTx(tx) ? 40 : 0).duration(280)}
          style={isVirtualNumberTx(tx) ? { marginTop: 16 } : undefined}>
          <SocialBoostStatusPanel tx={tx} />
        </Animated.View>
      ) : null}

      {hasStatusSection && !receiptOpen ? (
        <Animated.View entering={FadeInDown.delay(40).duration(280)} style={{ marginTop: 20 }}>
          <Pressable
            style={({ pressed }) => [
              styles.viewReceiptBtn,
              pressed && { opacity: 0.92 },
            ]}
            onPress={() => setReceiptOpen(true)}>
            <Text style={styles.viewReceiptText}>View receipt</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {showReceipt ? (
        <>
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={hasStatusSection ? { marginTop: 20 } : undefined}>
            <View ref={receiptRef} collapsable={false} style={styles.receiptCard}>
              <LinearGradient
                colors={['#FF8124', Brand.orange, '#E85D00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.receiptHero}>
                <View style={styles.brandRow}>
                  <View style={styles.logoWell}>
                    <Image
                      source={require('@/assets/images/oryno-logo.png')}
                      style={styles.logo}
                      contentFit="cover"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.brandEyebrow}>ORYNO</Text>
                    <Text style={styles.brandTitle}>Transaction receipt</Text>
                  </View>
                </View>

                <View style={styles.heroCenter}>
                  <StatusHeroIcon status={tx.status} />
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <Text style={styles.txAmount}>{tx.amount}</Text>
                  <StatusPill status={tx.status} />
                </View>
              </LinearGradient>

              <View style={styles.details}>
                <ReceiptWatermark />
                <View style={styles.detailsContent}>
                  <DetailRow label="Category" value={tx.categoryLabel} />
                  <DetailRow label="Details" value={tx.subtitle} />
                  {tx.category === 'refund' && credit ? (
                    <View style={styles.refundNote}>
                      <Text style={styles.refundText}>
                        This credit was added back to your{' '}
                        <Text style={styles.refundEmph}>ORYNO wallet balance</Text>
                        . It is not a refund to your bank account. Check Wallet for your
                        current balance.
                      </Text>
                    </View>
                  ) : null}
                  <DetailRow label="Type" value={credit ? 'Credit' : 'Debit'} />
                  <DetailRow label="Date" value={tx.createdAtFormatted} />
                  <DetailRow label="Reference" value={tx.reference} mono />
                  <DetailRow
                    label="Currency"
                    value={
                      isSocialBoostTx(tx)
                        ? tx.currency ?? 'USD'
                        : tx.currency ?? 'NGN'
                    }
                  />
                  {isVirtualNumberTx(tx) ? (
                    <VirtualNumberDetails meta={tx.metadata} />
                  ) : null}
                  {isSocialBoostTx(tx) ? (
                    <>
                      <DetailRow label="Paid from" value="USD wallet" />
                      <SocialBoostDetails meta={tx.metadata} />
                    </>
                  ) : null}
                </View>
              </View>

              <Text style={styles.footer}>
                Powered by ORYNO · Keep this receipt for your records
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(280)} style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                (sharing || pressed) && { opacity: sharing ? 0.55 : 0.9 },
              ]}
              disabled={sharing || downloading}
              onPress={() => void onShare()}>
              {sharing ? (
                <ActivityIndicator size="small" color={Brand.orange} />
              ) : (
                <Ionicons name="share-outline" size={18} color={Brand.orange} />
              )}
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.downloadBtn,
                (downloading || pressed) && { opacity: downloading ? 0.55 : 0.92 },
              ]}
              disabled={sharing || downloading}
              onPress={() => void onDownload()}>
              {downloading ? (
                <ActivityIndicator size="small" color={Brand.white} />
              ) : (
                <Ionicons name="download-outline" size={18} color={Brand.white} />
              )}
              <Text style={styles.downloadText}>Download</Text>
            </Pressable>
          </Animated.View>
        </>
      ) : null}
    </Screen>
  );
}

function VirtualNumberDetails({ meta }: { meta: Record<string, unknown> | null }) {
  const phone = metaString(meta, 'phoneNumber');
  const service = metaString(meta, 'service');
  if (!phone && !service) return null;
  return (
    <>
      {phone ? <DetailRow label="Phone" value={phone} mono /> : null}
      {service ? <DetailRow label="Service" value={service} /> : null}
    </>
  );
}

function SocialBoostDetails({ meta }: { meta: Record<string, unknown> | null }) {
  const link = metaString(meta, 'link');
  const qty = meta?.quantity;
  const quantity =
    typeof qty === 'number'
      ? qty.toLocaleString()
      : typeof qty === 'string'
        ? qty
        : null;
  if (!link && !quantity) return null;
  return (
    <>
      {quantity ? <DetailRow label="Quantity" value={quantity} /> : null}
      {link ? <DetailRow label="Link" value={link} mono /> : null}
    </>
  );
}

function SocialBoostStatusPanel({ tx }: { tx: TransactionReceipt }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const orderId = metaString(tx.metadata, 'japOrderId') || tx.externalRef || null;
  const cached = metaString(tx.metadata, 'japStatus');

  const [status, setStatus] = useState<string | null>(cached);
  const [remains, setRemains] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!orderId) {
      setError('Order id missing for this boost');
      return;
    }
    setFetching(true);
    setError(null);
    try {
      const data = await api.get<{
        error?: string;
        data?: { status?: string; remains?: string; start_count?: string };
      }>(endpoints.jap.status(orderId));
      if (data.error) throw new Error(data.error);
      if (data.data?.status) setStatus(String(data.data.status));
      if (data.data?.remains != null) setRemains(String(data.data.remains));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get status');
    } finally {
      setFetching(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    if (cached && /complet|partial|cancel|fail/i.test(cached)) return;
    void fetchStatus();
  }, [orderId, cached, fetchStatus]);

  if (!orderId) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Ionicons name="trending-up" size={16} color={Brand.orange} />
        <Text style={styles.panelTitle}>Boost status</Text>
      </View>
      <View style={styles.panelBody}>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Provider status</Text>
          <Text style={styles.metaValue}>
            {status || (fetching ? 'Checking…' : '—')}
          </Text>
          {remains != null && remains !== '' ? (
            <Text style={styles.metaHint}>Remaining: {remains}</Text>
          ) : null}
        </View>
        {error ? <Text style={styles.panelError}>{error}</Text> : null}
        <Pressable
          style={[styles.panelBtn, fetching && { opacity: 0.6 }]}
          disabled={fetching}
          onPress={() => void fetchStatus()}>
          {fetching ? (
            <ActivityIndicator color={Brand.white} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={Brand.white} />
              <Text style={styles.panelBtnText}>Refresh status</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function VirtualNumberCodePanel({ tx }: { tx: TransactionReceipt }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const activationId =
    metaString(tx.metadata, 'activationId') || tx.externalRef || null;
  const phone = metaString(tx.metadata, 'phoneNumber');
  const cachedCode = metaString(tx.metadata, 'smsCode');

  const [code, setCode] = useState<string | null>(cachedCode);
  const [fetching, setFetching] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refunded, setRefunded] = useState(
    tx.status === 'Reversed' ||
      tx.statusRaw === 'reversed' ||
      tx.statusRaw === 'failed',
  );

  const fetchCode = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!activationId) {
        setError('Activation id missing for this number');
        return null;
      }
      if (!opts?.silent) setFetching(true);
      setError(null);
      try {
        const data = await api.get<{
          error?: string;
          code?: string | null;
          refunded?: boolean;
          status?: string;
          data?: { code?: string | null };
        }>(endpoints.services.numbersStatus(activationId));
        if (data.refunded || data.status === 'STATUS_CANCEL') {
          setRefunded(true);
          setPolling(false);
          return null;
        }
        const next =
          (typeof data.code === 'string' && data.code) ||
          (typeof data.data?.code === 'string' && data.data.code) ||
          null;
        if (next) {
          setCode(next);
          setPolling(false);
        }
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not get SMS code');
        return null;
      } finally {
        if (!opts?.silent) setFetching(false);
      }
    },
    [activationId],
  );

  useEffect(() => {
    setCode(cachedCode);
  }, [cachedCode, tx.id]);

  useEffect(() => {
    if (!activationId || code || refunded) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setPolling(true);

    async function tick() {
      if (cancelled) return;
      tries += 1;
      const next = await fetchCode({ silent: true });
      if (cancelled) return;
      if (next || refunded || tries >= 450) {
        setPolling(false);
        return;
      }
      timer = setTimeout(tick, 8000);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activationId, code, refunded, fetchCode]);

  async function onCopy(value: string, label: string) {
    try {
      await Clipboard.setStringAsync(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  }

  if (!activationId && !phone && !code) return null;

  const codeLabel = code
    ? code
    : refunded
      ? 'Reversed — no SMS'
      : polling || fetching
        ? 'Waiting for SMS…'
        : 'Not received yet';

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={Brand.orange} />
        <Text style={styles.panelTitle}>SMS code</Text>
      </View>
      <View style={styles.panelBody}>
        {phone ? (
          <View style={styles.copyBox}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.metaLabel}>Phone number</Text>
              <Text style={[styles.metaValue, styles.mono]} numberOfLines={1}>
                {phone}
              </Text>
            </View>
            <Pressable
              style={styles.copyIconBtn}
              onPress={() => void onCopy(phone, 'Phone number')}
              hitSlop={8}>
              <Ionicons name="copy-outline" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.copyBox}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.metaLabel}>Verification code</Text>
            <Text
              style={[
                styles.metaValue,
                code ? styles.mono : { color: colors.mutedForeground },
              ]}
              numberOfLines={1}>
              {codeLabel}
            </Text>
          </View>
          {code ? (
            <Pressable
              style={styles.copyIconBtn}
              onPress={() => void onCopy(code, 'SMS code')}
              hitSlop={8}>
              <Ionicons name="copy-outline" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : polling || fetching ? (
            <ActivityIndicator size="small" color={Brand.orange} />
          ) : (
            <Ionicons name="call-outline" size={16} color={colors.mutedForeground} />
          )}
        </View>

        {error ? <Text style={styles.panelError}>{error}</Text> : null}

        <Pressable
          style={[styles.panelBtn, (!activationId || fetching) && { opacity: 0.6 }]}
          disabled={!activationId || fetching}
          onPress={() => void fetchCode()}>
          {fetching ? (
            <ActivityIndicator color={Brand.white} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={Brand.white} />
              <Text style={styles.panelBtnText}>{code ? 'Refresh code' : 'Get code'}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function StatusHeroIcon({ status }: { status: string }) {
  return <StatusMarkIcon status={status} color={Brand.white} />;
}

function ReceiptWatermark() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const marks = useMemo(() => Array.from({ length: 36 }, (_, i) => i), []);
  const ink = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(28,28,30,0.055)';
  const logoOpacity = isDark ? 0.035 : 0.025;

  return (
    <View pointerEvents="none" style={styles.watermarkWrap}>
      <View style={styles.watermarkGrid}>
        {marks.map((i) => (
          <View key={i} style={styles.watermarkMark}>
            <Image
              source={require('@/assets/images/oryno-logo.png')}
              style={[styles.watermarkLogo, { opacity: logoOpacity }]}
              contentFit="cover"
              tintColor={isDark ? 'rgba(255,255,255,0.9)' : 'rgba(28,28,30,0.9)'}
            />
            <Text style={[styles.watermarkLabel, { color: ink }]}>ORYNO</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = normalizeStatusMark(status);
  const icon =
    label === 'Failed'
      ? ('close-circle-outline' as const)
      : label === 'Reversed'
        ? ('refresh-circle-outline' as const)
        : label === 'Pending'
          ? ('time-outline' as const)
          : ('checkmark-circle-outline' as const);

  return (
    <View style={styles.statusPill}>
      <Ionicons name={icon} size={14} color={Brand.white} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.detailRow, styles.detailBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, mono && styles.detailMono]}
        numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function ReceiptSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.receiptCard}>
      <LinearGradient
        colors={['#FF8124', Brand.orange, '#E85D00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.receiptHero, { opacity: 0.85 }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logoWell, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={{ gap: 8 }}>
            <View style={styles.skelLightWide} />
            <View style={styles.skelLight} />
          </View>
        </View>
        <View style={[styles.heroCenter, { marginTop: 14 }]}>
          <View style={[styles.typeIcon, { opacity: 0.5 }]} />
          <View style={[styles.skelLight, { marginTop: 12, width: 140 }]} />
          <View style={[styles.skelLightWide, { marginTop: 12, height: 28, width: 160 }]} />
        </View>
      </LinearGradient>
      <View style={styles.details}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.detailRow, styles.detailBorder]}>
            <View style={styles.skelDarkSm} />
            <View style={styles.skelDarkMd} />
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    receiptCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    receiptHero: {
      paddingHorizontal: 18,
      paddingVertical: 20,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoWell: {
      width: 44,
      height: 44,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: Brand.orange,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.25)',
      zIndex: 2,
    },
    logo: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
      transform: [{ scale: 1.22 }],
    },
    brandEyebrow: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2,
    },
    brandTitle: {
      marginTop: 2,
      color: Brand.white,
      fontSize: 14,
      fontWeight: '700',
    },
    heroCenter: {
      marginTop: 20,
      alignItems: 'center',
    },
    typeIcon: {
      width: 56,
      height: 56,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    watermarkWrap: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    watermarkGrid: {
      position: 'absolute',
      top: -40,
      left: -60,
      right: -60,
      bottom: -40,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'center',
      justifyContent: 'center',
      gap: 18,
      columnGap: 28,
      transform: [{ rotate: '-32deg' }, { scale: 1.05 }],
    },
    watermarkMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      width: 108,
    },
    watermarkLogo: {
      width: 18,
      height: 18,
      borderRadius: 999,
    },
    watermarkLabel: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    detailsContent: {
      position: 'relative',
      zIndex: 1,
    },
    txTitle: {
      marginTop: 12,
      color: 'rgba(255,255,255,0.8)',
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
    txAmount: {
      marginTop: 4,
      color: Brand.white,
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    statusPill: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    statusText: {
      color: Brand.white,
      fontSize: 12,
      fontWeight: '700',
    },
    details: {
      position: 'relative',
      overflow: 'hidden',
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
    },
    detailBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.6,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
    },
    detailValue: {
      maxWidth: '62%',
      textAlign: 'right',
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
      textTransform: 'capitalize',
    },
    detailMono: {
      fontFamily: 'Menlo',
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.3,
      textTransform: 'none',
    },
    refundNote: {
      marginVertical: 8,
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    refundText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    refundEmph: {
      fontWeight: '700',
      color: colors.foreground,
    },
    footer: {
      paddingHorizontal: 18,
      paddingBottom: 18,
      paddingTop: 8,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    viewReceiptBtn: {
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewReceiptText: {
      fontSize: 14,
      fontWeight: '700',
      color: Brand.white,
    },
    actions: {
      marginTop: 20,
      flexDirection: 'row',
      gap: 12,
    },
    shareBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    shareText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    downloadBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    downloadText: { fontSize: 14, fontWeight: '800', color: Brand.white },
    panel: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    panelTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    panelBody: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      gap: 12,
    },
    metaBox: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    metaLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.mutedForeground,
    },
    metaValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    metaHint: {
      marginTop: 4,
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    mono: {
      fontFamily: 'Menlo',
      letterSpacing: 0.4,
    },
    copyBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    copyIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelError: {
      fontSize: 12,
      fontWeight: '600',
      color: Brand.error,
    },
    panelBtn: {
      height: 44,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    panelBtnText: {
      color: Brand.white,
      fontSize: 14,
      fontWeight: '700',
    },
    errorCard: {
      marginTop: 12,
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 40,
      alignItems: 'center',
    },
    errorTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    errorSub: {
      marginTop: 8,
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 12,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    skelLight: {
      height: 12,
      width: 110,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.35)',
    },
    skelLightWide: {
      height: 10,
      width: 72,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    skelDarkSm: {
      height: 12,
      width: 72,
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    skelDarkMd: {
      height: 12,
      width: 110,
      borderRadius: 6,
      backgroundColor: colors.border,
    },
  });
}
