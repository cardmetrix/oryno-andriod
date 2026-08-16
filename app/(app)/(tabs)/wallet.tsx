import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  UsdWalletActionsPanel,
  UsdWalletCard,
  type UsdPanel,
} from '@/components/app/usd-wallet-card';
import { WalletLocalCard } from '@/components/app/wallet-local-card';
import { Screen } from '@/components/ui/screen';
import { WalletPageSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useWallet } from '@/hooks/use-wallet';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

type PagerItem = 'local' | 'usd';

function currencySymbol(currency: string) {
  if (currency === 'NGN') return '₦';
  if (currency === 'GHS') return 'GH₵';
  if (currency === 'KES') return 'KSh';
  if (currency === 'ZAR') return 'R';
  return `${currency} `;
}

export default function WalletScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading, error, refresh } = useWallet();
  const invalidateWallet = useInvalidateWallet();
  const [hidden, setHidden] = useState(false);
  const [walletView, setWalletView] = useState<PagerItem>('local');
  const [usdPanel, setUsdPanel] = useState<UsdPanel>('fund');
  const pagerRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(windowWidth - 32);
  const skipNextFocusRefresh = useRef(true);

  const softRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const { pulling, onRefresh } = usePullRefresh(softRefresh);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefresh.current) {
        skipNextFocusRefresh.current = false;
        return;
      }
      void softRefresh();
    }, [softRefresh]),
  );

  const localDot = useSharedValue(1);
  const usdDot = useSharedValue(0);

  useEffect(() => {
    localDot.value = withSpring(walletView === 'local' ? 1 : 0, {
      damping: 18,
      stiffness: 220,
    });
    usdDot.value = withSpring(walletView === 'usd' ? 1 : 0, {
      damping: 18,
      stiffness: 220,
    });
  }, [walletView, localDot, usdDot]);

  const localDotStyle = useAnimatedStyle(() => ({
    width: 8 + localDot.value * 16,
    backgroundColor: localDot.value > 0.5 ? Brand.orange : 'rgba(142,142,147,0.35)',
  }));

  const usdDotStyle = useAnimatedStyle(() => ({
    width: 8 + usdDot.value * 16,
    backgroundColor: usdDot.value > 0.5 ? Brand.orange : 'rgba(142,142,147,0.35)',
  }));

  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(pageWidth, 1));
    setWalletView(idx >= 1 ? 'usd' : 'local');
  };

  const scrollToPage = (index: 0 | 1) => {
    setWalletView(index === 0 ? 'local' : 'usd');
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
  };

  async function setPrimary(id: string) {
    try {
      await api.patch(endpoints.wallet.banks, { id, makePrimary: true });
      invalidateWallet();
      await softRefresh();
    } catch (err) {
      alert.error(
        'Could not update bank',
        err instanceof Error ? err.message : 'Could not update bank',
      );
    }
  }

  async function removeAccount(id: string) {
    alert.confirm('Remove bank', 'Remove this payout account?', {
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.delete(`${endpoints.wallet.banks}?id=${encodeURIComponent(id)}`);
          invalidateWallet();
          await softRefresh();
        } catch (err) {
          alert.error(
            'Could not remove bank',
            err instanceof Error ? err.message : 'Could not remove bank',
          );
        }
      },
    });
  }

  if (loading && !data) {
    return (
      <Screen scroll>
        <WalletPageSkeleton />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen scroll header={<WalletHeader />}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Wallet unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!data) return null;

  const currency = data.totals.currency ?? data.primary.currency ?? 'NGN';
  const symbol = currencySymbol(currency);
  const showLocalSections = walletView === 'local';

  return (
    <Screen scroll refreshing={pulling} onRefresh={onRefresh} header={<WalletHeader />}>
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={onPagerScroll}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.width);
          if (next > 0 && next !== pageWidth) setPageWidth(next);
        }}
        style={styles.pager}>
        <View style={{ width: pageWidth }}>
          <WalletLocalCard
            currency={data.totals.currency ?? data.primary.currency}
            balanceFormatted={data.primary.balanceFormatted}
            holderName={data.user.fullName}
            countryCode={data.user.countryCode}
            status={data.primary.status}
            hidden={hidden}
            onToggleHidden={() => setHidden((v) => !v)}
          />
        </View>
        <View style={{ width: pageWidth }}>
          <UsdWalletCard
            usd={data.usd}
            hidden={hidden}
            panel={usdPanel}
            onPanelChange={setUsdPanel}
            holderName={data.user.fullName}
            countryCode={data.user.countryCode}
          />
        </View>
      </ScrollView>

      {/* Always directly under the wallet cards */}
      <View style={styles.pagerHint}>
        <View style={styles.dots}>
          <Pressable onPress={() => scrollToPage(0)} hitSlop={10}>
            <Animated.View style={[styles.dot, localDotStyle]} />
          </Pressable>
          <Pressable onPress={() => scrollToPage(1)} hitSlop={10}>
            <Animated.View style={[styles.dot, usdDotStyle]} />
          </Pressable>
        </View>
        <Animated.Text
          key={walletView}
          entering={FadeIn.duration(220)}
          style={styles.hintText}>
          {walletView === 'local' ? 'Swipe for USD wallet' : 'Swipe for local wallet'}
        </Animated.Text>
      </View>

      {walletView === 'usd' ? (
        <UsdWalletActionsPanel
          localCurrency={data.totals.currency ?? data.primary.currency}
          localBalanceFormatted={data.primary.balanceFormatted}
          fx={data.fx}
          panel={usdPanel}
          onPanelChange={setUsdPanel}
          onUpdated={() => void softRefresh()}
        />
      ) : null}

      {showLocalSections ? (
        <Animated.View
          key="local-sections"
          entering={FadeInDown.duration(320).springify().damping(18)}
          exiting={FadeOutUp.duration(180)}
          layout={Layout.springify().damping(18)}>
          <View style={styles.statsRow}>
            {[
              {
                label: 'Balance',
                value: hidden
                  ? '••••'
                  : `${symbol}${Number(data.totals.balance).toLocaleString('en-NG', {
                      maximumFractionDigits: 0,
                    })}`,
                ion: 'wallet-outline' as const,
              },
              {
                label: 'Banks',
                value: String(data.totals.bankCount ?? data.banks.length),
                material: 'account-balance' as const,
              },
              {
                label: 'Recent',
                value: String(data.recent.length),
                ion: 'time-outline' as const,
              },
            ].map((stat, i) => (
              <Animated.View
                key={stat.label}
                entering={FadeInDown.delay(40 + i * 40).duration(280)}
                style={styles.statCard}>
                <View style={styles.statIcon}>
                  {'material' in stat && stat.material ? (
                    <MaterialIcons name={stat.material} size={16} color={Brand.orange} />
                  ) : (
                    <Ionicons name={stat.ion!} size={16} color={Brand.orange} />
                  )}
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View
            entering={FadeInDown.delay(80).duration(300)}
            layout={Layout.springify().damping(18)}
            style={styles.panel}>
            <View style={styles.panelHead}>
              <View style={styles.panelHeadLeft}>
                <View style={styles.panelIcon}>
                  <MaterialIcons name="account-balance" size={20} color={Brand.orange} />
                </View>
                <View>
                  <Text style={styles.panelTitle}>Bank accounts</Text>
                  <Text style={styles.panelSub}>For instant withdrawals</Text>
                </View>
              </View>
              <Pressable
                style={styles.addBankBtn}
                onPress={() => router.push('/(app)/wallet/add-bank')}>
                <Ionicons name="add" size={16} color={Brand.white} />
                <Text style={styles.addBankText}>Add bank</Text>
              </Pressable>
            </View>

            <View style={{ gap: 12 }}>
              {data.banks.map((account, index) => (
                <Animated.View
                  key={account.id}
                  entering={FadeInDown.delay(index * 40).duration(260)}
                  style={[styles.bankCard, account.isPrimary && styles.bankCardPrimary]}>
                  <View style={styles.bankRow}>
                    <View style={styles.bankIcon}>
                      <MaterialIcons name="account-balance" size={18} color={Brand.orange} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.bankTitleRow}>
                        <Text style={styles.bankName} numberOfLines={1}>
                          {account.bankName}
                        </Text>
                        {account.isPrimary ? (
                          <View style={styles.primaryPill}>
                            <Text style={styles.primaryPillText}>PRIMARY</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.bankAccountName} numberOfLines={1}>
                        {account.accountName}
                      </Text>
                      <Text style={styles.bankNumber}>
                        {account.accountNumber || account.maskedNumber}
                      </Text>
                    </View>
                    <View style={styles.bankActions}>
                      {!account.isPrimary ? (
                        <Pressable onPress={() => void setPrimary(account.id)}>
                          <Text style={styles.makePrimary}>Make primary</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={styles.trashBtn}
                        onPress={() => void removeAccount(account.id)}
                        accessibilityLabel="Remove bank account">
                        <Ionicons name="trash-outline" size={14} color={colors.grayMedium} />
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              ))}

              {data.banks.length === 0 ? (
                <View style={styles.emptyBanks}>
                  <Text style={styles.emptyBanksTitle}>No bank accounts yet</Text>
                  <Text style={styles.emptyBanksSub}>
                    Add a Paystack-verified bank to withdraw from your wallet.
                  </Text>
                  <Pressable
                    style={styles.emptyBanksBtn}
                    onPress={() => router.push('/(app)/wallet/add-bank')}>
                    <Text style={styles.emptyBanksBtnText}>Add bank account</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

function WalletHeader() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>My Wallet</Text>
        <Text style={styles.sub}>Balance, payout banks & recent activity</Text>
      </View>
      <Pressable
        style={styles.historyBtn}
        onPress={() => router.push('/(app)/(tabs)/history')}
        accessibilityLabel="Transaction history">
        <Text style={styles.historyBtnText}>History</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 0,
      marginBottom: 0,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.charcoal,
      letterSpacing: -0.4,
    },
    sub: { marginTop: 4, fontSize: 13, color: colors.grayMedium, fontWeight: '500' },
    historyBtn: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    historyBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.charcoal,
    },
    errorCard: {
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 28,
      alignItems: 'center',
    },
    errorTitle: { fontSize: 18, fontWeight: '800', color: colors.charcoal },
    errorSub: {
      marginTop: 6,
      fontSize: 13,
      color: colors.grayMedium,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 12,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
    pager: { width: '100%' },
    pagerHint: { alignItems: 'center', marginTop: 10, gap: 8 },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: {
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(142,142,147,0.35)',
    },
    hintText: { fontSize: 11, color: colors.grayMedium },
    statsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
      borderRadius: 22,
      backgroundColor: colors.card,
      padding: 10,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statLabel: {
      marginTop: 10,
      fontSize: 11,
      fontWeight: '600',
      color: colors.grayMedium,
    },
    statValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '800',
      color: colors.charcoal,
    },
    panel: {
      marginTop: 12,
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      padding: 12,
    },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    panelHeadLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    panelIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    panelSub: { marginTop: 2, fontSize: 13, color: colors.grayMedium },
    addBankBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    addBankText: { color: Brand.white, fontSize: 13, fontWeight: '700' },
    bankCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    bankCardPrimary: {
      borderColor: 'rgba(255,106,0,0.4)',
      backgroundColor: 'rgba(255,106,0,0.08)',
    },
    bankRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    bankIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.grayDivider,
    },
    bankTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    bankName: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    primaryPill: {
      backgroundColor: Brand.orange,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    primaryPillText: { color: Brand.white, fontSize: 10, fontWeight: '800' },
    bankAccountName: { marginTop: 2, fontSize: 12, color: colors.grayMedium },
    bankNumber: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '700',
      color: colors.charcoal,
      letterSpacing: 0.4,
      fontVariant: ['tabular-nums'],
    },
    bankActions: { alignItems: 'flex-end', gap: 8 },
    makePrimary: { fontSize: 12, fontWeight: '700', color: Brand.orange },
    trashBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyBanks: {
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.grayDivider,
      paddingHorizontal: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    emptyBanksTitle: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    emptyBanksSub: {
      marginTop: 4,
      fontSize: 12,
      color: colors.grayMedium,
      textAlign: 'center',
      lineHeight: 17,
    },
    emptyBanksBtn: {
      marginTop: 10,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    emptyBanksBtnText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
  });
}
