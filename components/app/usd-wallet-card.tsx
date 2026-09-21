import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
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

import { WalletCardShine } from '@/components/app/wallet-card-shine';
import { WalletCardUsdGlow } from '@/components/app/wallet-card-usd-glow';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { maskBalance } from '@/lib/format';
import { toast } from '@/lib/toast';
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

type CardProps = {
  usd: WalletSummary | null | undefined;
  hidden?: boolean;
  holderName?: string;
  panel: UsdPanel;
  onPanelChange: (panel: UsdPanel) => void;
};

type ActionsProps = {
  localCurrency: string;
  localBalance: number;
  localBalanceFormatted: string;
  usdBalance?: number;
  fx?: FxQuote | null;
  panel: UsdPanel;
  onPanelChange: (panel: UsdPanel) => void;
  onUpdated?: () => void;
};

const USD_PRESETS = ['5', '10', '20', '50', '100'];

/** Dark USD balance card — matches website `UsdWalletCard`. */
export function UsdWalletCard({
  usd,
  hidden,
  panel,
  onPanelChange,
}: CardProps) {
  const balance = usd?.balanceFormatted ?? '$0.00';

  return (
    <View style={styles.card}>
      <WalletCardUsdGlow />
      <WalletCardShine intensity="soft" />

      <View style={styles.content}>
        <View style={styles.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrowText}>USD Wallet</Text>
            <Text style={styles.balance} numberOfLines={1}>
              {maskBalance(Boolean(hidden), balance)}
            </Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={13} color={Brand.orange} />
            <Text style={styles.badgeText}>Protected</Text>
          </View>
        </View>

        <Text style={styles.holder}>USD Wallet</Text>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.fundBtn,
              panel === 'fund' ? styles.fundActive : styles.fundIdle,
              pressed && { opacity: 0.92 },
            ]}
            onPress={() => onPanelChange('fund')}>
            <Ionicons name="add" size={18} color="#111" />
            <Text style={styles.fundText}>Fund</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.convertBtn,
              panel === 'convert' ? styles.convertActive : styles.convertIdle,
              pressed && { opacity: 0.92 },
            ]}
            onPress={() => onPanelChange('convert')}>
            <Ionicons
              name="swap-horizontal"
              size={16}
              color={panel === 'convert' ? '#111' : Brand.white}
            />
            <Text
              style={[
                styles.convertText,
                panel === 'convert' ? styles.convertTextActive : null,
              ]}>
              Convert
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Fund / Convert form — matches website `UsdWalletActionsPanel`. */
export function UsdWalletActionsPanel({
  localCurrency,
  localBalance,
  localBalanceFormatted,
  usdBalance = 0,
  fx,
  onUpdated,
  panel,
  onPanelChange,
}: ActionsProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makePanelStyles(colors, isDark), [colors, isDark]);
  const [fundMethod, setFundMethod] = useState<'checkout' | 'convert'>('checkout');
  const [direction, setDirection] = useState<'to_usd' | 'to_local'>('to_usd');
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveFx, setLiveFx] = useState<FxQuote | null>(fx ?? null);

  useEffect(() => {
    setLiveFx(fx ?? null);
  }, [fx]);

  useEffect(() => {
    if (panel === 'fund') setFundMethod('checkout');
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

  const usdAmount = Number(amount) || 0;
  const localCost = liveFx && usdAmount > 0 ? usdAmount * liveFx.buyRate : 0;

  const needsLocalBalance =
    (panel === 'fund' && fundMethod === 'convert') ||
    (panel === 'convert' && direction === 'to_usd');
  const needsUsdBalance = panel === 'convert' && direction === 'to_local';

  const canSubmit = useMemo(() => {
    if (busy || !amount || usdAmount <= 0) return false;
    if (needsLocalBalance && localCost > localBalance) return false;
    if (needsUsdBalance && usdAmount > usdBalance) return false;
    return true;
  }, [
    busy,
    amount,
    usdAmount,
    needsLocalBalance,
    needsUsdBalance,
    localCost,
    localBalance,
    usdBalance,
  ]);

  const submitLabel = useMemo(() => {
    if (busy) return null;
    if (needsLocalBalance && localCost > localBalance) {
      return 'Insufficient local balance';
    }
    if (needsUsdBalance && usdAmount > usdBalance) {
      return 'Insufficient USD balance';
    }
    if (panel === 'fund') {
      return fundMethod === 'checkout'
        ? 'Fund with local currency'
        : `Convert from ${localCurrency}`;
    }
    return direction === 'to_usd'
      ? 'Convert to USD'
      : `Convert to ${localCurrency}`;
  }, [
    busy,
    needsLocalBalance,
    needsUsdBalance,
    localCost,
    localBalance,
    usdAmount,
    usdBalance,
    panel,
    fundMethod,
    direction,
    localCurrency,
  ]);

  async function onFund() {
    setBusy(true);
    setError(null);
    try {
      const callbackUrl = Linking.createURL('wallet', {
        scheme: 'oryno',
        queryParams: { usd_fund: '1' },
      });
      const json = await api.post<{
        error?: string;
        authorizationUrl?: string;
        transactionId?: string;
        usdFormatted?: string;
      }>(endpoints.wallet.usdFund, {
        amountUsd: amount,
        method: fundMethod,
        callbackUrl,
      });

      if (json.authorizationUrl) {
        await WebBrowser.openBrowserAsync(json.authorizationUrl);
        onUpdated?.();
        return;
      }

      toast.success('USD wallet funded', {
        description: json.usdFormatted ?? `$${amount} credited`,
      });
      onPanelChange('fund');
      onUpdated?.();
      if (json.transactionId) {
        router.push(`/(app)/history/${json.transactionId}`);
      }
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
        const json = await api.post<{
          transactionId?: string;
          toFormatted?: string;
        }>(endpoints.wallet.usdFund, {
          amountUsd: amount,
          method: 'convert',
        });
        toast.success('Converted to USD', {
          description: json.toFormatted,
        });
        onPanelChange('fund');
        onUpdated?.();
        if (json.transactionId) {
          router.push(`/(app)/history/${json.transactionId}`);
        }
        return;
      }

      const json = await api.post<{
        transactionId?: string;
        toFormatted?: string;
      }>(endpoints.wallet.convert, {
        direction: 'to_local',
        amount,
      });
      toast.success('Converted to local', {
        description: json.toFormatted,
      });
      onPanelChange('fund');
      onUpdated?.();
      if (json.transactionId) {
        router.push(`/(app)/history/${json.transactionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Animated.View
      key={panel}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(140)}
      style={styles.wrap}>
      <View style={styles.panel}>
        {panel === 'fund' ? (
          <>
            <Text style={styles.panelTitle}>Fund USD wallet</Text>
            <Text style={styles.panelSub}>
              Fund with local currency or convert from your {localCurrency}{' '}
              balance ({localBalanceFormatted}).
            </Text>
            <View style={styles.segRow}>
              <Pressable
                style={[
                  styles.seg,
                  fundMethod === 'checkout' && styles.segActive,
                ]}
                onPress={() => setFundMethod('checkout')}>
                <Text
                  style={[
                    styles.segText,
                    fundMethod === 'checkout' && styles.segTextActive,
                  ]}>
                  Local currency
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.seg,
                  fundMethod === 'convert' && styles.segActive,
                ]}
                onPress={() => setFundMethod('convert')}>
                <Text
                  style={[
                    styles.segText,
                    fundMethod === 'convert' && styles.segTextActive,
                  ]}>
                  From {localCurrency}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.panelTitle}>Convert currencies</Text>
            <Text style={styles.panelSub}>
              Live open-market rate + 1% ORYNO commission.
            </Text>
            <View style={styles.segRow}>
              <Pressable
                style={[styles.seg, direction === 'to_usd' && styles.segActive]}
                onPress={() => setDirection('to_usd')}>
                <Text
                  style={[
                    styles.segText,
                    direction === 'to_usd' && styles.segTextActive,
                  ]}>
                  {localCurrency} → USD
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.seg,
                  direction === 'to_local' && styles.segActive,
                ]}
                onPress={() => setDirection('to_local')}>
                <Text
                  style={[
                    styles.segText,
                    direction === 'to_local' && styles.segTextActive,
                  ]}>
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
          {USD_PRESETS.map((preset) => {
            const active = amount === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => setAmount(preset)}
                style={[styles.preset, active && styles.presetActive]}>
                <Text
                  style={[
                    styles.presetText,
                    active && styles.presetTextActive,
                  ]}>
                  ${preset}
                </Text>
              </Pressable>
            );
          })}
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
          disabled={!canSubmit}
          onPress={() => void (panel === 'fund' ? onFund() : onConvert())}
          style={[styles.cta, !canSubmit && { opacity: 0.5 }]}>
          {busy ? (
            <View style={styles.ctaBusy}>
              <ActivityIndicator color={Brand.white} />
              <Text style={styles.ctaText}>Processing…</Text>
            </View>
          ) : (
            <Text style={styles.ctaText}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: '#1C1C1E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    minHeight: 140,
    shadowColor: '#0F0F12',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrowText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  balance: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  holder: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
  },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  fundBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fundIdle: { backgroundColor: Brand.white },
  fundActive: { backgroundColor: Brand.orange },
  fundText: { color: '#111', fontSize: 14, fontWeight: '800' },
  convertBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  convertIdle: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  convertActive: {
    backgroundColor: Brand.orange,
    borderColor: 'transparent',
  },
  convertText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
  convertTextActive: { color: '#111' },
});

function makePanelStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    wrap: {
      marginTop: 12,
      marginBottom: 24,
    },
    panel: {
      borderRadius: 22,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      shadowColor: '#0F0F12',
      shadowOpacity: isDark ? 0.28 : 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    panelTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    panelSub: {
      marginTop: 4,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 17,
    },
    segRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
    seg: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 10,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    segActive: {
      borderColor: Brand.orange,
      backgroundColor: colors.orangeMuted,
    },
    segText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    segTextActive: { color: Brand.orange },
    fieldLabel: {
      marginTop: 16,
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    input: {
      marginTop: 8,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(245,245,247,0.7)',
      paddingHorizontal: 16,
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
    },
    presets: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    preset: {
      borderRadius: 999,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    presetActive: {
      backgroundColor: Brand.charcoal,
    },
    presetText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
    presetTextActive: { color: Brand.white },
    preview: {
      marginTop: 16,
      borderRadius: 16,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(245,245,247,0.8)',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    previewLabel: { fontSize: 13, color: colors.mutedForeground },
    previewValue: {
      marginTop: 2,
      fontSize: 16,
      fontWeight: '800',
      color: colors.foreground,
    },
    previewReceive: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '700',
      color: Brand.orange,
    },
    error: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '600',
      color: Brand.error,
    },
    cta: {
      marginTop: 16,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    ctaBusy: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ctaText: {
      color: Brand.white,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
}
