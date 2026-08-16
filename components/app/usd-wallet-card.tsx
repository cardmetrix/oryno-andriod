import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { maskBalance } from '@/lib/format';
import type { WalletSummary } from '@/lib/types';

type FxQuote = {
  midRate: number;
  buyRate: number;
  sellRate: number;
  commissionPercent?: number;
  provider?: string;
  quote?: string;
};

export type UsdPanel = 'fund' | 'convert';

type SharedProps = {
  usd: WalletSummary | null | undefined;
  localCurrency: string;
  localBalanceFormatted: string;
  fx?: FxQuote | null;
  hidden?: boolean;
  onUpdated?: () => void;
  panel: UsdPanel;
  onPanelChange: (panel: UsdPanel) => void;
};

const USD_PRESETS = ['5', '10', '20', '50', '100'];

/** Dark USD balance card (Fund / Convert). Panel renders separately below swipe. */
export function UsdWalletCard({
  usd,
  hidden,
  panel,
  onPanelChange,
  holderName,
  countryCode,
}: Pick<SharedProps, 'usd' | 'hidden' | 'panel' | 'onPanelChange'> & {
  holderName: string;
  countryCode: string;
}) {
  const balance = usd?.balanceFormatted ?? '$0.00';
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistBusy, setWaitlistBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await api.get<{ joined?: boolean }>(endpoints.waitlist.usdCard);
        if (!cancelled) setWaitlistJoined(Boolean(json.joined));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />

      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>USD WALLET</Text>
          </View>
          <Animated.Text
            key={hidden ? 'h' : balance}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.balance}
            numberOfLines={1}>
            {maskBalance(Boolean(hidden), balance)}
          </Animated.Text>
          <Text style={styles.holder} numberOfLines={1}>
            {holderName} · USD wallet
          </Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={13} color={Brand.orange} />
          <Text style={styles.badgeText}>Protected</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.fundBtn, panel === 'fund' && styles.fundActive]}
          onPress={() => onPanelChange('fund')}>
          <Ionicons name="add" size={18} color="#111" />
          <Text style={styles.fundText}>Fund</Text>
        </Pressable>
        <Pressable
          style={[styles.convertBtn, panel === 'convert' && styles.convertActive]}
          onPress={() => onPanelChange(panel === 'convert' ? 'fund' : 'convert')}>
          <Ionicons
            name="swap-horizontal"
            size={16}
            color={panel === 'convert' ? '#111' : Brand.white}
          />
          <Text style={[styles.convertText, panel === 'convert' && { color: '#111' }]}>
            Convert
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Fund (default) / Convert form — themed for light & dark. */
export function UsdWalletActionsPanel({
  localCurrency,
  localBalanceFormatted,
  fx,
  onUpdated,
  panel,
  onPanelChange,
}: Omit<SharedProps, 'usd' | 'hidden'>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makePanelStyles(colors), [colors]);
  const [fundMethod, setFundMethod] = useState<'paystack' | 'convert'>('paystack');
  const [direction, setDirection] = useState<'to_usd' | 'to_local'>('to_usd');
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveFx, setLiveFx] = useState<FxQuote | null>(fx ?? null);

  useEffect(() => {
    setLiveFx(fx ?? null);
  }, [fx]);

  useEffect(() => {
    setError(null);
  }, [panel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await api.get<{ quote?: FxQuote }>(
          `${endpoints.wallet.fx}?currency=${encodeURIComponent(localCurrency)}&direction=${direction}&amount=${encodeURIComponent(amount || '0')}`,
        );
        if (!cancelled && json.quote) setLiveFx(json.quote);
      } catch {
        // keep existing quote
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localCurrency, direction, amount, panel]);

  const preview = useMemo(() => {
    if (!liveFx || !amount || Number(amount) <= 0) return null;
    const n = Number(amount);
    if (panel === 'fund' || (panel === 'convert' && direction === 'to_usd')) {
      const localCost = n * liveFx.buyRate;
      return {
        label: `You pay · ${localCurrency}`,
        value: localCost.toLocaleString('en-NG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        receive: `You get · $${n.toFixed(2)}`,
      };
    }
    if (panel === 'convert' && direction === 'to_local') {
      const localGets = n * liveFx.sellRate;
      return {
        label: 'You send · USD',
        value: n.toFixed(2),
        receive: `You get · ${localCurrency} ${localGets.toLocaleString('en-NG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      };
    }
    return null;
  }, [liveFx, amount, panel, direction, localCurrency]);

  async function onFund() {
    setBusy(true);
    setError(null);
    try {
      const json = await api.post<{
        error?: string;
        authorizationUrl?: string;
      }>(endpoints.wallet.usdFund, {
        amountUsd: amount,
        method: fundMethod,
      });

      if (json.authorizationUrl) {
        await WebBrowser.openBrowserAsync(json.authorizationUrl);
        onUpdated?.();
        return;
      }

      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Funding failed');
    } finally {
      setBusy(false);
    }
  }

  async function onConvert() {
    setBusy(true);
    setError(null);
    try {
      if (direction === 'to_usd') {
        await api.post(endpoints.wallet.usdFund, {
          amountUsd: amount,
          method: 'convert',
        });
      } else {
        await api.post(endpoints.wallet.convert, {
          direction: 'to_local',
          amount,
        });
      }
      onPanelChange('fund');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      {panel === 'fund' ? (
        <>
          <Text style={styles.panelTitle}>Fund USD wallet</Text>
          <View style={styles.segRow}>
            <Pressable
              style={[styles.seg, fundMethod === 'paystack' && styles.segActive]}
              onPress={() => setFundMethod('paystack')}>
              <Text
                style={[styles.segText, fundMethod === 'paystack' && styles.segTextActive]}>
                Paystack
              </Text>
            </Pressable>
            <Pressable
              style={[styles.seg, fundMethod === 'convert' && styles.segActive]}
              onPress={() => setFundMethod('convert')}>
              <Text
                style={[styles.segText, fundMethod === 'convert' && styles.segTextActive]}>
                From {localCurrency}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.panelTitle}>Convert currencies</Text>
          <View style={styles.segRow}>
            <Pressable
              style={[styles.seg, direction === 'to_usd' && styles.segActive]}
              onPress={() => setDirection('to_usd')}>
              <Text style={[styles.segText, direction === 'to_usd' && styles.segTextActive]}>
                {localCurrency} → USD
              </Text>
            </Pressable>
            <Pressable
              style={[styles.seg, direction === 'to_local' && styles.segActive]}
              onPress={() => setDirection('to_local')}>
              <Text
                style={[styles.segText, direction === 'to_local' && styles.segTextActive]}>
                USD → {localCurrency}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.fieldLabel}>USD amount</Text>
      <TextInput
        value={amount}
        onChangeText={(v) =>
          setAmount(v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))
        }
        keyboardType="decimal-pad"
        style={styles.input}
        placeholder="10"
        placeholderTextColor={colors.mutedForeground}
      />

      <View style={styles.presets}>
        {USD_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => setAmount(preset)}
            style={[styles.preset, amount === preset && styles.presetActive]}>
            <Text style={[styles.presetText, amount === preset && styles.presetTextActive]}>
              ${preset}
            </Text>
          </Pressable>
        ))}
      </View>

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>{preview.label}</Text>
          <Text style={styles.previewValue}>{preview.value}</Text>
          <Text style={styles.previewReceive}>{preview.receive}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={busy || !amount || Number(amount) <= 0}
        onPress={() => void (panel === 'fund' ? onFund() : onConvert())}
        style={[styles.cta, (busy || !amount || Number(amount) <= 0) && { opacity: 0.5 }]}>
        {busy ? (
          <ActivityIndicator color={Brand.white} />
        ) : (
          <Text style={styles.ctaText}>
            {panel === 'fund'
              ? fundMethod === 'paystack'
                ? 'Pay with Paystack'
                : `Convert from ${localCurrency}`
              : direction === 'to_usd'
                ? 'Convert to USD'
                : `Convert to ${localCurrency}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    backgroundColor: Brand.charcoal,
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
    minHeight: 140,
  },
  glowA: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,106,0,0.22)',
  },
  glowB: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  balance: {
    marginTop: 4,
    color: Brand.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  holder: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  waitlistBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    maxWidth: '100%',
  },
  waitlistText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800' },
  actions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  fundBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: Brand.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fundActive: { backgroundColor: Brand.orange },
  fundText: { color: '#111', fontSize: 14, fontWeight: '800' },
  convertBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  convertActive: { backgroundColor: Brand.orange, borderColor: 'transparent' },
  convertText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
});

function makePanelStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      marginTop: 10,
      marginBottom: 28,
      borderRadius: 18,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 10,
    },
    panelTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    panelSub: {
      marginTop: 2,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    segRow: { marginTop: 8, flexDirection: 'row', gap: 6 },
    seg: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    segActive: {
      borderColor: Brand.orange,
      backgroundColor: colors.orangeMuted,
    },
    segText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    segTextActive: { color: Brand.orange },
    fieldLabel: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: colors.foreground,
    },
    input: {
      marginTop: 6,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    presets: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    preset: {
      borderRadius: 999,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    presetActive: { backgroundColor: colors.foreground },
    presetText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    presetTextActive: { color: colors.background },
    preview: {
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    previewLabel: { fontSize: 12, color: colors.mutedForeground },
    previewValue: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: '800',
      color: colors.foreground,
    },
    previewReceive: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '700',
      color: Brand.orange,
    },
    error: { marginTop: 8, fontSize: 13, fontWeight: '600', color: Brand.error },
    cta: {
      marginTop: 8,
      height: 42,
      borderRadius: 12,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
  });
}
