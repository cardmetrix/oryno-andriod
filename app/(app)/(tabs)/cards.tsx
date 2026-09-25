import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { TransactionPinModal } from '@/components/app/transaction-pin-modal';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useSettlePendingTransactions } from '@/hooks/use-settle-pending-transactions';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type VirtualCard = {
  id: string;
  brand: string;
  label: string;
  last4: string;
  expMonth: number;
  expYear: number;
  expLabel: string;
  status: 'active' | 'frozen' | 'terminated';
  provider: string;
  maskedNumber: string;
  createdAt: string;
};

type CardsPayload = {
  issuer: string;
  issueFeeUsd: number;
  issueFeeFormatted: string;
  maxActiveCards: number;
  holderName: string;
  usd: {
    id: string;
    balance: string;
    balanceFormatted: string;
    status: string;
  };
  cards: VirtualCard[];
};

const VIRTUAL_CARD_BG = require('@/assets/images/usd-virtual-card-bg.png');

type Revealed = {
  panFormatted: string;
  cvv: string;
  expLabel: string;
  holderName?: string;
};

export default function CardsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    usd_fund?: string;
    tx_ref?: string;
    reference?: string;
    trxref?: string;
    transaction_id?: string;
    transactionId?: string;
  }>();
  const invalidateWallet = useInvalidateWallet();
  useSettlePendingTransactions(true);

  const [data, setData] = useState<CardsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState('20');
  const verifyStarted = useRef<string | null>(null);
  const skipNextFocusRefresh = useRef(true);

  const load = useCallback(async () => {
    try {
      const json = await api.get<CardsPayload>(endpoints.wallet.cards);
      setData(json);
      setSelectedId((prev) => {
        if (prev && json.cards.some((c) => c.id === prev)) return prev;
        return json.cards[0]?.id ?? null;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, []);

  const softRefresh = useCallback(async () => {
    await load();
    invalidateWallet();
  }, [load, invalidateWallet]);

  const { pulling, onRefresh } = usePullRefresh(softRefresh);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefresh.current) {
        skipNextFocusRefresh.current = false;
        return;
      }
      void load();
    }, [load]),
  );

  useEffect(() => {
    const usdFund = params.usd_fund;
    const reference =
      params.tx_ref || params.reference || params.trxref;
    const transactionId = params.transaction_id || params.transactionId;
    if (!usdFund || (!reference && !transactionId)) return;

    const key = `${reference ?? ''}|${transactionId ?? ''}`;
    if (verifyStarted.current === key) return;
    verifyStarted.current = key;

    let cancelled = false;
    (async () => {
      try {
        const json = await api.post<{
          error?: string;
          amountFormatted?: string;
        }>(endpoints.wallet.usdVerify, { reference, transactionId });
        if (cancelled) return;
        toast.success('USD wallet funded', {
          description: json.amountFormatted,
        });
        await softRefresh();
        router.replace('/(app)/(tabs)/cards');
      } catch (err) {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : 'USD payment verification failed',
        );
        router.replace('/(app)/(tabs)/cards');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, softRefresh]);

  const selected =
    data?.cards.find((c) => c.id === selectedId) ?? data?.cards[0] ?? null;

  async function onIssue() {
    setIssuing(true);
    try {
      const json = await api.post<{
        error?: string;
        card?: VirtualCard;
        feeFormatted?: string;
      }>(endpoints.wallet.cards, {});
      toast.success('USD card issued', {
        description: json.feeFormatted ? `Fee ${json.feeFormatted}` : undefined,
      });
      setRevealed(null);
      setHidden(true);
      await softRefresh();
      if (json.card) setSelectedId(json.card.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not issue card');
    } finally {
      setIssuing(false);
    }
  }

  async function onRevealPin(pin: string) {
    if (!selected) return;
    setPinLoading(true);
    setPinError(null);
    try {
      const json = await api.post<Revealed & { error?: string }>(
        endpoints.wallet.cardReveal(selected.id),
        { pin },
      );
      setRevealed({
        panFormatted: json.panFormatted,
        cvv: json.cvv,
        expLabel: json.expLabel,
        holderName: json.holderName,
      });
      setHidden(false);
      setPinOpen(false);
      toast.success('Card details unlocked');
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Reveal failed');
    } finally {
      setPinLoading(false);
    }
  }

  async function onStatus(status: 'active' | 'frozen' | 'terminated') {
    if (!selected) return;
    setBusyStatus(true);
    try {
      await api.post(endpoints.wallet.cardStatus(selected.id), { status });
      toast.success(
        status === 'frozen'
          ? 'Card frozen'
          : status === 'terminated'
            ? 'Card terminated'
            : 'Card unfrozen',
      );
      setRevealed(null);
      setHidden(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyStatus(false);
    }
  }

  function confirmTerminate() {
    alert.confirm('Terminate card', 'This card cannot be used again after termination.', {
      confirmLabel: 'Terminate',
      destructive: true,
      onConfirm: () => void onStatus('terminated'),
    });
  }

  async function onFundUsd() {
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid USD amount');
      return;
    }
    setFunding(true);
    try {
      const callbackUrl = Linking.createURL('wallet', {
        scheme: 'oryno',
        queryParams: { usd_fund: '1' },
      });
      const json = await api.post<{
        error?: string;
        authorizationUrl?: string;
      }>(endpoints.wallet.usdFund, {
        amountUsd: amount,
        method: 'checkout',
        callbackUrl,
      });
      if (!json.authorizationUrl) {
        throw new Error('Payment page unavailable');
      }
      await WebBrowser.openBrowserAsync(json.authorizationUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Funding failed');
    } finally {
      setFunding(false);
    }
  }

  async function copyNumber() {
    if (!revealed) return;
    await Clipboard.setStringAsync(revealed.panFormatted.replace(/\s/g, ''));
    toast.success('Card number copied');
  }

  const displayNumber =
    !hidden && revealed
      ? revealed.panFormatted
      : selected?.maskedNumber ?? '•••• •••• •••• ••••';
  const displayExp =
    !hidden && revealed ? revealed.expLabel : selected?.expLabel ?? '••/••';
  const displayCvv = !hidden && revealed ? revealed.cvv : '•••';
  const holder =
    revealed?.holderName || data?.holderName || 'ORYNO USER';

  const header = (
    <PageHeader
      title="Cards"
      subtitle="USD virtual cards for online payments"
      showBack={false}
      right={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/history')}
          hitSlop={8}
          accessibilityLabel="Transaction history">
          <Text style={styles.historyLink}>History</Text>
        </Pressable>
      }
    />
  );

  if (loading && !data) {
    return (
      <Screen scroll header={header}>
        <View style={{ gap: 12 }}>
          <Skeleton width="100%" height={72} radius={18} />
          <Skeleton width="100%" height={200} radius={22} />
          <Skeleton width="100%" height={160} radius={22} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll header={header}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Cards unavailable</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={pulling} onRefresh={onRefresh} header={header}>
      <Animated.View entering={FadeInDown.duration(200)} style={styles.balanceStrip}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.balanceEyebrow}>USD wallet · spendable</Text>
          <Text style={styles.balanceValue}>{data.usd.balanceFormatted}</Text>
        </View>
        <Pressable onPress={() => router.push('/(app)/convert')}>
          <Text style={styles.convertLink}>Convert local → USD</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(220)}>
        <ImageBackground
          source={VIRTUAL_CARD_BG}
          resizeMode="cover"
          imageStyle={styles.virtualCardImage}
          style={styles.virtualCard}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.18)', 'transparent']}
          locations={[0, 0.42, 0.78]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.cardTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardIssuer}>
              ORYNO · {data.issuer.toUpperCase()}
            </Text>
            <Text style={styles.cardLabel} numberOfLines={1}>
              {selected?.label ?? 'USD Virtual Card'}
            </Text>
          </View>
          <View style={styles.cardBadges}>
            {selected ? (
              <View
                style={[
                  styles.statusPill,
                  selected.status === 'active' && styles.statusActive,
                  selected.status === 'frozen' && styles.statusFrozen,
                  selected.status === 'terminated' && styles.statusTerminated,
                ]}>
                <Text style={styles.statusPillText}>{selected.status}</Text>
              </View>
            ) : null}
            <View style={styles.visaPill}>
              <Text style={styles.visaText}>VISA</Text>
            </View>
          </View>
        </View>

        <View style={styles.chip} />

        <View style={styles.panRow}>
          <Text style={styles.pan} numberOfLines={1}>
            {displayNumber}
          </Text>
          <Pressable
            disabled={!selected}
            onPress={() => {
              if (hidden) {
                setPinError(null);
                setPinOpen(true);
              } else {
                setHidden(true);
                setRevealed(null);
              }
            }}
            style={[styles.eyeCircle, !selected && { opacity: 0.4 }]}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={Brand.white}
            />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.metaLabel}>Cardholder</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {holder}
            </Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Exp</Text>
            <Text style={styles.metaMono}>{displayExp}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>CVV</Text>
            <Text style={styles.metaMono}>{displayCvv}</Text>
          </View>
        </View>
        </ImageBackground>
      </Animated.View>

      {data.cards.length > 1 ? (
        <View style={styles.cardPicker}>
          {data.cards.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => {
                setSelectedId(card.id);
                setRevealed(null);
                setHidden(true);
              }}
              style={[
                styles.cardPickerBtn,
                selected?.id === card.id && styles.cardPickerBtnActive,
              ]}>
              <Text
                style={[
                  styles.cardPickerText,
                  selected?.id === card.id && styles.cardPickerTextActive,
                ]}>
                •••• {card.last4}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(80).duration(220)} style={styles.panel}>
        {selected ? (
          <View style={styles.actionGrid}>
            <ActionTile
              icon="copy-outline"
              label="Copy number"
              disabled={hidden || !revealed}
              onPress={() => void copyNumber()}
            />
            <ActionTile
              icon={selected.status === 'frozen' ? 'lock-open-outline' : 'snow-outline'}
              label={selected.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
              disabled={busyStatus || selected.status === 'terminated'}
              onPress={() =>
                void onStatus(selected.status === 'frozen' ? 'active' : 'frozen')
              }
            />
            <ActionTile
              icon="lock-closed-outline"
              label="Reveal"
              disabled={selected.status === 'terminated'}
              onPress={() => {
                setPinError(null);
                setPinOpen(true);
              }}
            />
            <ActionTile
              icon="trash-outline"
              label="Terminate"
              danger
              disabled={busyStatus}
              onPress={confirmTerminate}
            />
          </View>
        ) : (
          <Text style={styles.emptyHint}>
            No USD virtual card yet. Issue one to pay online worldwide — spends from
            your USD wallet balance.
          </Text>
        )}

        <Pressable
          disabled={issuing || data.cards.length >= data.maxActiveCards}
          onPress={() => void onIssue()}
          style={({ pressed }) => [
            styles.issueBtn,
            (issuing || data.cards.length >= data.maxActiveCards) && { opacity: 0.5 },
            pressed && { opacity: 0.92 },
          ]}>
          {issuing ? (
            <ActivityIndicator color={Brand.white} />
          ) : (
            <>
              <Ionicons name="add" size={18} color={Brand.white} />
              <Text style={styles.issueBtnText}>
                {data.cards.length === 0
                  ? `Issue USD card · ${data.issueFeeFormatted}`
                  : `Issue another · ${data.issueFeeFormatted}`}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={styles.issueFoot}>
          Fee is charged from your USD wallet. Max {data.maxActiveCards} active cards.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(220)} style={styles.panel}>
        <View style={styles.fundHead}>
          <Ionicons name="card-outline" size={18} color={Brand.orange} />
          <Text style={styles.fundTitle}>Fund USD wallet</Text>
        </View>
        <View style={styles.amountPills}>
          {['10', '20', '50', '100'].map((p) => (
            <Pressable
              key={p}
              onPress={() => setFundAmount(p)}
              style={[
                styles.amountPill,
                fundAmount === p && styles.amountPillActive,
              ]}>
              <Text
                style={[
                  styles.amountPillText,
                  fundAmount === p && styles.amountPillTextActive,
                ]}>
                ${p}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={fundAmount}
          onChangeText={(t) => setFundAmount(t.replace(/[^\d.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="Amount USD"
          placeholderTextColor={colors.grayMedium}
          style={styles.amountInput}
        />
        <Pressable
          disabled={funding}
          onPress={() => void onFundUsd()}
          style={({ pressed }) => [
            styles.fundBtn,
            funding && { opacity: 0.6 },
            pressed && { opacity: 0.92 },
          ]}>
          {funding ? (
            <ActivityIndicator color={Brand.white} />
          ) : (
            <>
              <Ionicons name="add" size={18} color={Brand.white} />
              <Text style={styles.fundBtnText}>Pay with card / mobile money</Text>
            </>
          )}
        </Pressable>
      </Animated.View>

      <TransactionPinModal
        visible={pinOpen}
        mode="confirm"
        title="Confirm to reveal card"
        description="Enter your transaction PIN to view the full card number and CVV."
        confirmLabel="Reveal card"
        loading={pinLoading}
        error={pinError}
        onClose={() => setPinOpen(false)}
        onConfirm={({ pin }) => void onRevealPin(pin)}
      />
    </Screen>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeActionStyles(colors, danger), [colors, danger]);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.92 },
      ]}>
      <Ionicons
        name={icon}
        size={18}
        color={danger ? Brand.error : Brand.orange}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function makeActionStyles(colors: ThemeColors, danger?: boolean) {
  return StyleSheet.create({
    tile: {
      flex: 1,
      minWidth: '46%',
      alignItems: 'center',
      gap: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: danger ? 'rgba(239,68,68,0.25)' : colors.grayDivider,
      backgroundColor: colors.muted,
      paddingVertical: 12,
      paddingHorizontal: 6,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: danger ? Brand.error : colors.charcoal,
      textAlign: 'center',
    },
  });
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    historyLink: { fontSize: 14, fontWeight: '700', color: Brand.orange },
    errorCard: {
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      padding: 24,
      alignItems: 'center',
    },
    errorTitle: { fontSize: 17, fontWeight: '800', color: colors.charcoal },
    retryBtn: {
      marginTop: 12,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    retryText: { color: Brand.white, fontWeight: '700' },
    balanceStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.grayDivider,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    balanceEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.grayMedium,
      textTransform: 'uppercase',
    },
    balanceValue: {
      marginTop: 4,
      fontSize: 20,
      fontWeight: '800',
      color: colors.charcoal,
    },
    convertLink: { fontSize: 12, fontWeight: '700', color: Brand.orange },
    virtualCard: {
      borderRadius: 22,
      backgroundColor: '#0A0A0C',
      padding: 18,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.1)',
      marginBottom: 12,
    },
    virtualCardImage: { borderRadius: 22 },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 16,
    },
    cardIssuer: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: 'rgba(255,255,255,0.7)',
    },
    cardLabel: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.92)',
    },
    cardBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statusActive: { backgroundColor: 'rgba(16,185,129,0.25)' },
    statusFrozen: { backgroundColor: 'rgba(56,189,248,0.25)' },
    statusTerminated: { backgroundColor: 'rgba(255,255,255,0.08)' },
    statusPillText: {
      fontSize: 9,
      fontWeight: '800',
      color: Brand.white,
      textTransform: 'uppercase',
    },
    visaPill: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    visaText: {
      fontSize: 9,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 0.5,
    },
    chip: {
      width: 44,
      height: 32,
      borderRadius: 6,
      backgroundColor: 'rgba(251,191,36,0.85)',
      marginBottom: 16,
    },
    panRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    pan: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: Brand.white,
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
    },
    eyeCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
    },
    metaLabel: {
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 0.6,
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
    },
    metaValue: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
      color: Brand.white,
      textTransform: 'uppercase',
    },
    metaMono: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '700',
      color: Brand.white,
      fontVariant: ['tabular-nums'],
    },
    cardPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    cardPickerBtn: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.muted,
    },
    cardPickerBtnActive: {
      backgroundColor: Brand.orange,
      borderColor: Brand.orange,
    },
    cardPickerText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.grayMedium,
    },
    cardPickerTextActive: { color: Brand.white },
    panel: {
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.grayDivider,
      padding: 14,
      marginBottom: 12,
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    emptyHint: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.grayMedium,
      marginBottom: 12,
    },
    issueBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    issueBtnText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
    issueFoot: {
      marginTop: 8,
      fontSize: 11,
      color: colors.grayMedium,
      textAlign: 'center',
    },
    fundHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    fundTitle: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    amountPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    amountPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.muted,
    },
    amountPillActive: {
      backgroundColor: Brand.orange,
      borderColor: Brand.orange,
    },
    amountPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.grayMedium,
    },
    amountPillTextActive: { color: Brand.white },
    amountInput: {
      marginTop: 10,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      fontSize: 15,
      fontWeight: '700',
      color: colors.charcoal,
    },
    fundBtn: {
      marginTop: 10,
      height: 44,
      borderRadius: 14,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    fundBtnText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
  });
}
