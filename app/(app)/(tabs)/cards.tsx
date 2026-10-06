import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { TransactionPinModal } from '@/components/app/transaction-pin-modal';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useSettlePendingTransactions } from '@/hooks/use-settle-pending-transactions';
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

type WaitlistStatus = {
  joined: boolean;
  joinedAt: string | null;
  provider: string;
};

type PendingOrder = {
  id: string;
  status:
    | 'pending_payment'
    | 'paid_pending_review'
    | 'approved'
    | 'rejected'
    | 'issued';
  feeFormatted: string;
  localFormatted: string;
  localCurrency: string;
};

type CardsPayload = {
  issuer: string;
  issueFeeUsd: number;
  issueFeeFormatted: string;
  maxActiveCards: number;
  comingSoon?: boolean;
  holderName: string;
  pendingOrder?: PendingOrder | null;
  waitlist?: WaitlistStatus;
  cards: VirtualCard[];
};

type Revealed = {
  panFormatted: string;
  cvv: string;
  expLabel: string;
  holderName?: string;
};

const VIRTUAL_CARD_BG = require('@/assets/images/usd-virtual-card-bg.png');

const COMING_SOON_DETAILS = [
  {
    icon: 'globe-outline' as const,
    title: 'Spend worldwide',
    body: 'Pay for subscriptions, ads, and online stores that accept Visa.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Secure by design',
    body: 'Freeze anytime. Reveal PAN and CVV only with your transaction PIN.',
  },
];

export default function CardsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    usd_fund?: string;
    card_purchase?: string;
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
  const [joining, setJoining] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
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
    const reference = params.tx_ref || params.reference || params.trxref;
    const transactionId = params.transaction_id || params.transactionId;
    const cardPurchase = params.card_purchase;
    const usdFund = params.usd_fund;
    if ((!cardPurchase && !usdFund) || (!reference && !transactionId)) return;

    const key = `${cardPurchase ?? ''}|${usdFund ?? ''}|${reference ?? ''}|${transactionId ?? ''}`;
    if (verifyStarted.current === key) return;
    verifyStarted.current = key;

    let cancelled = false;
    (async () => {
      try {
        if (cardPurchase) {
          await api.post(endpoints.wallet.cardPurchaseVerify, {
            reference,
            transactionId,
          });
          if (cancelled) return;
          toast.success('Payment received', {
            description: 'Your card purchase is being reviewed.',
          });
        } else {
          const json = await api.post<{ amountFormatted?: string }>(
            endpoints.wallet.usdVerify,
            { reference, transactionId },
          );
          if (cancelled) return;
          toast.success('Wallet funded successfully', {
            description: json.amountFormatted,
          });
        }
        await softRefresh();
        router.replace('/(app)/(tabs)/cards');
      } catch (err) {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : 'Could not verify payment',
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
  const waitlistJoined = Boolean(data?.waitlist?.joined);
  const pendingOrder = data?.pendingOrder ?? null;
  const pendingReview = pendingOrder?.status === 'paid_pending_review';

  const displayNumber =
    !hidden && revealed
      ? revealed.panFormatted
      : (selected?.maskedNumber ?? '**** **** **** ****');
  const displayExp =
    !hidden && revealed ? revealed.expLabel : (selected?.expLabel ?? '**/**');
  const displayCvv = !hidden && revealed ? revealed.cvv : '***';
  const holder = revealed?.holderName || data?.holderName || 'ORYNO USER';

  async function onJoinWaitlist() {
    setJoining(true);
    try {
      const json = await api.post<{ created?: boolean }>(endpoints.waitlist.usdCard);
      toast.success(
        json.created ? "You're on the waitlist" : "You're already on the waitlist",
        {
          description: "We'll notify you by email and push when cards launch.",
        },
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setJoining(false);
    }
  }

  async function onLeaveWaitlist() {
    setJoining(true);
    try {
      await api.delete(endpoints.waitlist.usdCard);
      toast.success('Removed from waitlist');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not leave');
    } finally {
      setJoining(false);
    }
  }

  async function onRevealPin(pin: string) {
    if (!selectedId) return;
    setPinLoading(true);
    setPinError(null);
    try {
      const json = await api.post<Revealed & { error?: string }>(
        endpoints.wallet.cardReveal(selectedId),
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
      toast.success('Card details revealed');
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Invalid PIN');
    } finally {
      setPinLoading(false);
    }
  }

  async function onStatus(status: 'active' | 'frozen' | 'terminated') {
    if (!selectedId) return;
    setBusyStatus(true);
    try {
      await api.post(endpoints.wallet.cardStatus(selectedId), { status });
      toast.success(
        status === 'frozen'
          ? 'Card frozen'
          : status === 'active'
            ? 'Card unfrozen'
            : 'Card terminated',
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

  async function copyText(value: string, label: string) {
    try {
      await Clipboard.setStringAsync(value.replace(/\s/g, ''));
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  }

  const header = (
    <PageHeader
      title="Cards"
      subtitle="USD virtual cards for online payments"
      showBack={false}
    />
  );

  return (
    <Screen scroll refreshing={pulling} onRefresh={onRefresh} header={header}>
      {loading || !data ? (
        <View style={{ gap: 16 }}>
          <Skeleton height={192} radius={22} />
          <Skeleton height={128} radius={22} />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {pendingReview ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={18} color={Brand.orange} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>Card purchase under review</Text>
                <Text style={styles.pendingBody}>
                  We received {pendingOrder?.localFormatted ?? 'your payment'}. Our team will
                  issue your virtual card shortly.
                </Text>
              </View>
            </View>
          ) : null}
          {!selected ? (
            <>
              <CardSurface>
                <View style={styles.soonTop}>
                  <Text style={styles.soonBrand}>ORYNO</Text>
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>COMING SOON</Text>
                  </View>
                </View>
                <Text style={styles.soonTitle}>USD Virtual Card</Text>
                <Text style={styles.soonBody}>
                  A secure virtual card designed for seamless online payments,
                  including subscriptions and digital services such as Spotify,
                  Netflix, Apple Music, and more.
                </Text>
              </CardSurface>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>What you will get</Text>
                {COMING_SOON_DETAILS.map((item) => (
                  <View key={item.title} style={styles.detailRow}>
                    <View style={styles.iconBox}>
                      <Ionicons name={item.icon} size={16} color={Brand.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailTitle}>{item.title}</Text>
                      <Text style={styles.detailBody}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.panel}>
                {waitlistJoined ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.detailRow}>
                      <View style={styles.joinedIcon}>
                        <Ionicons name="checkmark" size={16} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailTitle}>You are on the waitlist</Text>
                        <Text style={styles.detailBody}>
                          {data.waitlist?.joinedAt
                            ? `Joined ${new Date(data.waitlist.joinedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}`
                            : 'You will be notified at launch'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.detailBody}>
                      We will email and push you when {data.issuer} cards go live.
                    </Text>
                    <Pressable
                      disabled={joining}
                      onPress={() => void onLeaveWaitlist()}
                      style={[styles.leaveBtn, joining && styles.disabled]}>
                      <Text style={styles.leaveText}>
                        {joining ? 'Leaving...' : 'Leave waitlist'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={styles.detailTitle}>Join the waitlist</Text>
                      <Text style={[styles.detailBody, { marginTop: 2 }]}>
                        Get notified the moment {data.issuer} USD virtual cards launch.
                      </Text>
                    </View>
                    <Pressable
                      disabled={joining}
                      onPress={() => void onJoinWaitlist()}
                      style={[styles.joinBtn, joining && styles.disabled]}>
                      <Ionicons name="notifications-outline" size={16} color={Brand.white} />
                      <Text style={styles.joinText}>
                        {joining ? 'Joining...' : 'Join waitlist'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          ) : (
            <CardSurface>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardIssuer}>
                    ORYNO · {data.issuer.toUpperCase()}
                  </Text>
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {selected.label ?? 'USD Virtual Card'}
                  </Text>
                </View>
                <View style={styles.cardBadges}>
                  <View
                    style={[
                      styles.statusPill,
                      selected.status === 'active' && styles.statusActive,
                      selected.status === 'frozen' && styles.statusFrozen,
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        selected.status === 'active' && { color: '#A7F3D0' },
                        selected.status === 'frozen' && { color: '#BAE6FD' },
                      ]}>
                      {selected.status}
                    </Text>
                  </View>
                  <View style={styles.visaPill}>
                    <Text style={styles.visaText}>VISA</Text>
                  </View>
                </View>
              </View>

              <View style={styles.chip}>
                <View style={styles.chipInner} />
              </View>

              <View style={styles.panRow}>
                <Text style={styles.pan} numberOfLines={1}>
                  {displayNumber}
                </Text>
                <Pressable
                  onPress={() => {
                    if (hidden) {
                      setPinError(null);
                      setPinOpen(true);
                    } else {
                      setHidden(true);
                      setRevealed(null);
                    }
                  }}
                  style={styles.eyeCircle}
                  accessibilityLabel={hidden ? 'Reveal card' : 'Hide card'}>
                  <Ionicons
                    name={hidden ? 'eye-outline' : 'eye-off-outline'}
                    size={16}
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
            </CardSurface>
          )}

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
                    **** {card.last4}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {selected ? (
            <View style={styles.panel}>
              <View style={styles.actionGrid}>
                <ActionTile
                  icon="copy-outline"
                  label="Copy number"
                  disabled={hidden || !revealed}
                  onPress={() =>
                    revealed && void copyText(revealed.panFormatted, 'Card number')
                  }
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
                  onPress={() => void onStatus('terminated')}
                />
              </View>
            </View>
          ) : null}
        </View>
      )}

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

function CardSurface({ children }: { children: React.ReactNode }) {
  const shine = useSharedValue(0);

  useEffect(() => {
    shine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
        withDelay(2000, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [shine]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -160 + shine.value * 520 }, { skewX: '-18deg' }],
  }));

  return (
    <ImageBackground
      source={VIRTUAL_CARD_BG}
      resizeMode="cover"
      imageStyle={surfaceStyles.image}
      style={surfaceStyles.card}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.28)',
          'rgba(0,0,0,0.08)',
          'rgba(0,0,0,0)',
        ]}
        locations={[0, 0.42, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[surfaceStyles.shine, shineStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={surfaceStyles.content}>{children}</View>
    </ImageBackground>
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
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        stylesAction.tile,
        {
          borderColor: danger ? 'rgba(255,59,48,0.3)' : colors.border,
          backgroundColor: colors.muted,
        },
        disabled && { opacity: 0.4 },
        pressed && !disabled && { transform: [{ scale: 0.97 }] },
      ]}>
      <Ionicons
        name={icon}
        size={16}
        color={danger ? Brand.error : colors.foreground}
      />
      <Text
        style={[
          stylesAction.label,
          { color: danger ? Brand.error : colors.foreground },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const surfaceStyles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0A0A0C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  image: { borderRadius: 22 },
  shine: { position: 'absolute', top: 0, bottom: 0, width: 120 },
  content: { padding: 20, gap: 16 },
});

const stylesAction = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '46%',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  label: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pendingBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,106,0,0.25)',
      backgroundColor: Brand.orangeMuted,
      padding: 14,
    },
    pendingTitle: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    pendingBody: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: colors.mutedForeground,
    },
    soonTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    soonBrand: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
    },
    soonBadge: {
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    soonBadgeText: {
      color: 'rgba(255,255,255,0.95)',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    soonTitle: {
      color: Brand.white,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    soonBody: {
      color: 'rgba(255,255,255,0.68)',
      fontSize: 14,
      lineHeight: 21,
    },
    panel: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 16,
      gap: 12,
    },
    panelTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    detailRow: { flexDirection: 'row', gap: 12 },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinedIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(16,185,129,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    detailBody: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 18,
      color: colors.mutedForeground,
    },
    joinBtn: {
      height: 44,
      borderRadius: 999,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    joinText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
    leaveBtn: {
      height: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaveText: { fontSize: 14, fontWeight: '700', color: colors.mutedForeground },
    disabled: { opacity: 0.5 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    cardIssuer: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2,
      color: 'rgba(255,255,255,0.5)',
    },
    cardLabel: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.95)',
    },
    cardBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statusActive: { backgroundColor: 'rgba(16,185,129,0.2)' },
    statusFrozen: { backgroundColor: 'rgba(14,165,233,0.2)' },
    statusPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: Brand.white,
      textTransform: 'uppercase',
    },
    visaPill: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    visaText: {
      fontSize: 10,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.95)',
      letterSpacing: 0.4,
    },
    chip: {
      width: 44,
      height: 32,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(252,211,77,0.9)',
    },
    chipInner: {
      width: 28,
      height: 20,
      borderRadius: 3,
      backgroundColor: 'rgba(254,243,199,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(120,53,15,0.2)',
    },
    panRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    pan: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: Brand.white,
      letterSpacing: 2,
    },
    eyeCircle: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    metaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    metaLabel: {
      fontSize: 10,
      letterSpacing: 0.6,
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
    },
    metaValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '700',
      color: Brand.white,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    metaMono: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '700',
      color: Brand.white,
    },
    cardPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cardPickerBtn: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },
    cardPickerBtnActive: {
      backgroundColor: Brand.orange,
      borderColor: Brand.orange,
    },
    cardPickerText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    cardPickerTextActive: { color: Brand.white },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
