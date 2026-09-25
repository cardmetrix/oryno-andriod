import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useWallet } from '@/hooks/use-wallet';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { cardEntering } from '@/lib/motion';
import { toast } from '@/lib/toast';

type FxQuote = {
  midRate: number;
  buyRate: number;
  sellRate: number;
  commissionPercent?: number;
  provider?: string;
};

/**
 * Convert local ↔ USD — mirrors website `/convert`.
 */
export default function ConvertScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ direction?: string }>();
  const { data: wallet, refresh } = useWallet();
  const invalidateWallet = useInvalidateWallet();

  const localCurrency = wallet?.primary.currency ?? 'NGN';
  const localBalance = Number(wallet?.primary.balance ?? 0);
  const usdBalance = Number(wallet?.usd?.balance ?? 0);

  const [direction, setDirection] = useState<'to_usd' | 'to_local'>(
    params.direction === 'to_local' ? 'to_local' : 'to_usd',
  );
  const [amount, setAmount] = useState(direction === 'to_usd' ? '1000' : '10');
  const [fx, setFx] = useState<FxQuote | null>(wallet?.fx ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await api.get<{ quote?: FxQuote }>(
          `${endpoints.wallet.fx}?currency=${encodeURIComponent(localCurrency)}&direction=${direction}&amount=${encodeURIComponent(amount || '0')}`,
        );
        if (!cancelled && json.quote) setFx(json.quote);
      } catch {
        // keep existing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localCurrency, direction, amount]);

  const preview = useMemo(() => {
    const n = Number(amount);
    if (!fx || !Number.isFinite(n) || n <= 0) return null;
    if (direction === 'to_usd') {
      const usd = n / fx.buyRate;
      const feePct = fx.commissionPercent ?? 0;
      return {
        fromAmount: n,
        fromCurrency: localCurrency,
        toAmount: usd,
        toCurrency: 'USD',
        rate: fx.buyRate,
        feeLabel:
          feePct > 0 ? `${(feePct * 100).toFixed(2)}%` : 'Included in rate',
        resultingLocal: Math.max(0, localBalance - n),
        resultingUsd: usdBalance + usd,
      };
    }
    const local = n * fx.sellRate;
    return {
      fromAmount: n,
      fromCurrency: 'USD',
      toAmount: local,
      toCurrency: localCurrency,
      rate: fx.sellRate,
      feeLabel:
        (fx.commissionPercent ?? 0) > 0
          ? `${((fx.commissionPercent ?? 0) * 100).toFixed(2)}%`
          : 'Included in rate',
      resultingLocal: localBalance + local,
      resultingUsd: Math.max(0, usdBalance - n),
    };
  }, [amount, direction, fx, localBalance, localCurrency, usdBalance]);

  const insufficient =
    direction === 'to_usd'
      ? Number(amount) > localBalance
      : Number(amount) > usdBalance;

  async function onConfirm() {
    if (!preview || insufficient) return;
    setBusy(true);
    setError(null);
    try {
      const json = await api.post<{
        error?: string;
        transactionId?: string;
        creditTransactionId?: string;
        toFormatted?: string;
      }>(endpoints.wallet.convert, {
        direction,
        amount: Number(amount),
        localCurrency,
      });
      toast.success('Converted successfully', {
        description: json.toFormatted,
      });
      invalidateWallet();
      await refresh();
      const receiptId = json.transactionId || json.creditTransactionId;
      if (receiptId) {
        router.replace(`/(app)/history/${receiptId}`);
      } else {
        router.replace('/(app)/(tabs)/cards');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      scroll
      header={
        <PageHeader
          title="Convert"
          subtitle={`${localCurrency} ↔ USD`}
          showBack
        />
      }>
      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Convert"
      />

      <Animated.View entering={cardEntering(0)} style={styles.balanceBanner}>
        <Text style={styles.balanceLine}>
          <Text style={styles.muted}>{localCurrency} </Text>
          <Text style={styles.bold}>
            {wallet?.primary.balanceFormatted ?? '—'}
          </Text>
        </Text>
        <Text style={styles.balanceLine}>
          <Text style={styles.muted}>USD </Text>
          <Text style={styles.bold}>
            {wallet?.usd?.balanceFormatted ?? '$0.00'}
          </Text>
        </Text>
      </Animated.View>

      <Animated.View entering={cardEntering(0).delay(40)} style={styles.card}>
        <View style={styles.segRow}>
          {(
            [
              ['to_usd', `${localCurrency} → USD`],
              ['to_local', `USD → ${localCurrency}`],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => {
                setDirection(value);
                setConfirming(false);
                setAmount(value === 'to_usd' ? '1000' : '10');
              }}
              style={[styles.seg, direction === value && styles.segActive]}>
              <Text
                style={[
                  styles.segText,
                  direction === value && styles.segTextActive,
                ]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>
          Amount ({direction === 'to_usd' ? localCurrency : 'USD'})
        </Text>
        <TextInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v.replace(/[^\d.]/g, ''));
            setConfirming(false);
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />

        {preview ? (
          <View style={styles.details}>
            <Row
              label="You send"
              value={`${preview.fromCurrency} ${preview.fromAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              colors={colors}
              styles={styles}
            />
            <Row
              label="Exchange rate"
              value={`1 USD ≈ ${preview.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${localCurrency}`}
              colors={colors}
              styles={styles}
            />
            <Row
              label="Conversion fee"
              value={preview.feeLabel}
              colors={colors}
              styles={styles}
            />
            <Row
              label="You receive"
              value={`${preview.toCurrency} ${preview.toAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              emphasize
              colors={colors}
              styles={styles}
            />
            <View style={styles.divider} />
            <Row
              label={`Resulting ${localCurrency}`}
              value={preview.resultingLocal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              colors={colors}
              styles={styles}
            />
            <Row
              label="Resulting USD"
              value={preview.resultingUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              colors={colors}
              styles={styles}
            />
          </View>
        ) : null}

        {insufficient ? (
          <Text style={styles.warn}>
            Insufficient {direction === 'to_usd' ? localCurrency : 'USD'} balance
          </Text>
        ) : null}

        {!confirming ? (
          <Pressable
            style={[
              styles.primaryBtn,
              (!preview || insufficient) && { opacity: 0.5 },
            ]}
            disabled={!preview || insufficient}
            onPress={() => setConfirming(true)}>
            <Ionicons name="swap-horizontal" size={18} color={Brand.white} />
            <Text style={styles.primaryBtnText}>Review conversion</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmBlock}>
            <Text style={styles.confirmHint}>
              Confirm the amounts above. This moves funds between your local and
              USD wallets instantly.
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setConfirming(false)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.confirmPrimary, busy && { opacity: 0.7 }]}
                disabled={busy}
                onPress={() => void onConfirm()}>
                {busy ? (
                  <ActivityIndicator color={Brand.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Confirm convert</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>
    </Screen>
  );
}

function Row({
  label,
  value,
  emphasize,
  colors,
  styles,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: emphasize ? Brand.orange : colors.foreground },
        ]}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    balanceBanner: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      gap: 4,
    },
    balanceLine: { fontSize: 14 },
    muted: { color: colors.mutedForeground, fontWeight: '500' },
    bold: { color: colors.foreground, fontWeight: '800' },
    card: {
      borderRadius: Radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
    },
    segRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
      backgroundColor: colors.muted,
      borderRadius: 16,
      padding: 4,
    },
    seg: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    segActive: { backgroundColor: Brand.orange },
    segText: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
    segTextActive: { color: Brand.white },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 8,
    },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
    },
    details: {
      marginTop: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      padding: 14,
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    rowLabel: { fontSize: 13, color: colors.mutedForeground, flexShrink: 0 },
    rowValue: {
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'right',
      flex: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    warn: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '600',
      color: Brand.error,
    },
    primaryBtn: {
      marginTop: 18,
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
    confirmBlock: { marginTop: 16, gap: 12 },
    confirmHint: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.mutedForeground,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 12,
      padding: 12,
    },
    confirmRow: { flexDirection: 'row', gap: 8 },
    secondaryBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    confirmPrimary: { flex: 1, marginTop: 0 },
  });
}
