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
import { WalletCardShine } from '@/components/app/wallet-card-shine';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
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

/** Dark USD balance card — matches website `UsdWalletCard` + local card sizing. */
export function UsdWalletCard({
  usd,
  hidden,
  panel,
  onPanelChange,
}: Pick<SharedProps, 'usd' | 'hidden' | 'panel' | 'onPanelChange'> & {
  holderName?: string;
  countryCode?: string;
}) {
  const balance = usd?.balanceFormatted ?? '$0.00';

  return (
    <View style={styles.card}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />
      <WalletCardShine intensity="soft" />

      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrowText}>USD WALLET</Text>
          <Text style={styles.balance} numberOfLines={1}>
            {maskBalance(Boolean(hidden), balance)}
          </Text>
          <Text style={styles.holder}>USD wallet</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={13} color={Brand.orange} />
          <Text style={styles.badgeText}>Protected</Text>
        </View>
      </View>

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
    setError(null);
  }, [panel]);

  useEffect(() => {
    if (panel === 'fund') setFundMethod('checkout');
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

      alert.success('USD wallet funded', json.usdFormatted ?? `$${amount} credited`);
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
        alert.success('Converted to USD', json.toFormatted ?? `$${amount}`);
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
      alert.success('Converted to local', json.toFormatted ?? 'Done');
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
    <View style={styles.panel}>
      {panel === 'fund' ? (
        <>
          <Text style={styles.panelTitle}>Fund USD wallet</Text>
          <Text style={styles.panelSub}>
            Fund with local currency or convert from your {localCurrency} balance (
            {localBalanceFormatted}).
          </Text>
          <View style={styles.segRow}>
            <Pressable
              style={[styles.seg, fundMethod === 'checkout' && styles.segActive]}
              onPress={() => setFundMethod('checkout')}>
              <Text
                style={[styles.segText, fundMethod === 'checkout' && styles.segTextActive]}>
                Local currency
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
          <Text style={styles.panelSub}>
            Live open-market rate + 1% ORYNO commission.
          </Text>
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
              ? fundMethod === 'checkout'
                ? 'Fund with local currency'
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
    borderRadius: 28,
    backgroundColor: '#1C1C1E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: 'hidden',
    minHeight: 168,
    shadowColor: '#0F0F12',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  glowA: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,106,0,0.22)',
  },
  glowB: {
    position: 'absolute',
    bottom: -36,
    left: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrowText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  balance: {
    marginTop: 6,
    color: Brand.white,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  holder: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '800',
  },
  actions: { marginTop: 16, flexDirection: 'row', gap: 10 },
  fundBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fundIdle: { backgroundColor: Brand.white },
  fundActive: { backgroundColor: Brand.orange },
  fundText: { color: '#111', fontSize: 15, fontWeight: '800' },
  convertBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
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
  convertText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  convertTextActive: { color: '#111' },
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
