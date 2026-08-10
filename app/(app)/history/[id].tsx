import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import type { AppTransaction } from '@/lib/types';

type TransactionReceipt = AppTransaction & {
  amountRaw: string;
  amountUnsigned: string;
  balanceAfter: string | null;
  balanceAfterFormatted: string | null;
  externalRef: string | null;
  reference: string;
  categoryLabel: string;
  statusRaw: string;
  createdAtFormatted: string;
  metadata: Record<string, unknown> | null;
};

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

  function receiptText(receipt: TransactionReceipt) {
    const credit = receipt.type === 'credit';
    return [
      'ORYNO Transaction receipt',
      '',
      receipt.title,
      receipt.amount,
      `Status: ${statusLabel(receipt.status)}`,
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

  async function captureReceiptUri(): Promise<string | null> {
    try {
      const uri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      return uri.startsWith('file://') ? uri : `file://${uri}`;
    } catch {
      return null;
    }
  }

  async function onShare() {
    if (!tx) return;
    setSharing(true);
    try {
      const uri = await captureReceiptUri();
      if (uri && (await Sharing.isAvailableAsync())) {
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
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes('User did not share')) return;
      alert.error('Error', 'Couldn’t share receipt');
    } finally {
      setSharing(false);
    }
  }

  async function onDownload() {
    if (!tx) return;
    setDownloading(true);
    try {
      const uri = await captureReceiptUri();
      if (uri) {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (permission.granted) {
          await MediaLibrary.saveToLibraryAsync(uri);
          alert.success('Saved', 'Receipt saved to your photos.');
          return;
        }
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Save ORYNO Receipt',
            UTI: 'public.png',
          });
          return;
        }
      }
      await Share.share({
        title: 'ORYNO Receipt',
        message: receiptText(tx),
      });
    } catch {
      alert.error('Error', 'Couldn’t download receipt');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <PageHeader title="Receipt" subtitle="Transaction details" showBack />
        <ReceiptSkeleton />
      </Screen>
    );
  }

  if (!tx || error) {
    return (
      <Screen>
        <PageHeader title="Receipt" subtitle="Transaction details" showBack />
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

  return (
    <Screen scroll>
      <PageHeader title="Receipt" subtitle="Transaction details" showBack />

      <Animated.View entering={FadeInDown.duration(280)}>
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
              <View style={styles.typeIcon}>
                {credit ? (
                  <ArrowDownLeftIcon size={24} color={Brand.white} />
                ) : (
                  <ArrowUpRightIcon size={24} color={Brand.white} />
                )}
              </View>
              <Text style={styles.txTitle}>{tx.title}</Text>
              <Text style={styles.txAmount}>{tx.amount}</Text>
              <StatusPill status={tx.status} />
            </View>
          </LinearGradient>

          <View style={styles.details}>
            <DetailRow label="Category" value={tx.categoryLabel} />
            <DetailRow label="Details" value={tx.subtitle} />
            <DetailRow label="Type" value={credit ? 'Credit' : 'Debit'} />
            <DetailRow label="Date" value={tx.createdAtFormatted} />
            <DetailRow label="Reference" value={tx.reference} mono />
            <DetailRow label="Currency" value={tx.currency ?? 'NGN'} last />
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
    </Screen>
  );
}

function ArrowDownLeftIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 7L7 17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 17H7V7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ArrowUpRightIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 17L17 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7H17V17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function statusLabel(status: string) {
  const s = status.toLowerCase();
  if (s === 'failed') return 'Failed';
  if (s === 'pending') return 'Pending';
  if (s === 'success' || s === 'completed') return 'Completed';
  return status;
}

function StatusPill({ status }: { status: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = statusLabel(status);
  const icon =
    label === 'Failed'
      ? ('close-circle' as const)
      : label === 'Pending'
        ? ('time-outline' as const)
        : ('checkmark-circle' as const);

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
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
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
          <View key={i} style={[styles.detailRow, i < 4 && styles.detailBorder]}>
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
      paddingHorizontal: 12,
      paddingVertical: 12,
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
    logo: { width: '100%', height: '100%', borderRadius: 999,
    transform: [{ scale: 1.22 }] },
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
      marginTop: 12,
      alignItems: 'center',
    },
    typeIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
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
    footer: {
      paddingHorizontal: 12,
      paddingBottom: 14,
      paddingTop: 8,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    actions: {
      marginTop: 12,
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
    errorCard: {
      marginTop: 12,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
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
