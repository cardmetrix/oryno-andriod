import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { WalletCardShine } from '@/components/app/wallet-card-shine';
import { WalletCardSkeleton } from '@/components/ui/skeletons';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useWallet } from '@/hooks/use-wallet';
import { maskBalance } from '@/lib/format';

/** Matches website dashboard carousel `gap-1.5`. */
const SLIDE_GAP = 6;
const MD_BREAKPOINT = 768;
const USD_WALLET_BG = require('@/assets/images/usd-wallet-card-bg.png');

type Props = {
  loading?: boolean;
};

function PillButton({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'glass' | 'dark' | 'usd' | 'usdAlt';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillBtn,
        tone === 'glass' && styles.pillGlass,
        tone === 'dark' && styles.pillDarkBtn,
        tone === 'usd' && styles.pillUsd,
        tone === 'usdAlt' && styles.pillUsdAlt,
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}>
      <Ionicons name={icon} size={12} color={Brand.white} />
      <Text style={styles.pillBtnText}>{label}</Text>
    </Pressable>
  );
}

function PagerFooter({
  view,
  onGo,
}: {
  view: 'local' | 'usd';
  onGo: (t: 'local' | 'usd') => void;
}) {
  return (
    <View style={styles.footer}>
      <View style={styles.dots}>
        <Pressable
          accessibilityLabel="Local wallet"
          onPress={() => onGo('local')}
          style={[styles.dot, view === 'local' && styles.dotActive]}
        />
        <Pressable
          accessibilityLabel="USD wallet"
          onPress={() => onGo('usd')}
          style={[styles.dot, view === 'usd' && styles.dotActive]}
        />
      </View>
      <Pressable onPress={() => onGo(view === 'local' ? 'usd' : 'local')}>
        <Animated.Text
          key={view}
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(80)}
          style={styles.swipeHint}>
          {view === 'local' ? 'Swipe for USD ›' : '‹ Local wallet'}
        </Animated.Text>
      </Pressable>
    </View>
  );
}

/** Dashboard wallets — matches website `DashboardWalletCarousel`. */
export function DashboardWalletCarousel({ loading }: Props) {
  const { colors } = useAppTheme();
  const themeStyles = useMemo(() => makeThemeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isMd = width >= MD_BREAKPOINT;
  const cardWidth = width - 32;
  const stride = cardWidth + SLIDE_GAP;
  const { data, loading: walletLoading } = useWallet();
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<'local' | 'usd'>('local');
  const pagerRef = useRef<ScrollView>(null);

  if ((loading || walletLoading) && !data) {
    return <View style={styles.skeleton} />;
  }

  const localCurrency = data?.primary.currency ?? data?.country?.currency ?? 'NGN';
  const localFormatted = data?.primary.balanceFormatted ?? `${localCurrency} 0.00`;
  const usdFormatted = data?.usd?.balanceFormatted ?? '$0.00';

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (isMd) return;
    const x = e.nativeEvent.contentOffset.x;
    setView(x > stride * 0.45 ? 'usd' : 'local');
  }

  function scrollTo(target: 'local' | 'usd') {
    setView(target);
    if (isMd) return;
    pagerRef.current?.scrollTo({
      x: target === 'usd' ? stride : 0,
      animated: true,
    });
  }

  const localCard = (
    <LinearGradient
      colors={['#FF8124', Brand.orange, '#E85D00']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, isMd && themeStyles.mdCard]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.16)', 'transparent', 'rgba(180,60,0,0.18)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <WalletCardShine intensity="bright" />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brand}>ORYNO</Text>
            <Text style={styles.walletName}>{localCurrency} Wallet</Text>
          </View>
          <Pressable
            onPress={() => setHidden((v) => !v)}
            style={styles.eye}
            hitSlop={8}
            accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
            <Ionicons
              name={hidden ? 'eye-off' : 'eye'}
              size={13}
              color={Brand.white}
            />
          </Pressable>
        </View>

        <View>
          <Text style={styles.available}>Available balance</Text>
          <Text style={styles.balance} numberOfLines={1}>
            {maskBalance(hidden, localFormatted)}
          </Text>
        </View>

        <View style={styles.actions}>
          <PillButton
            label="Fund"
            icon="add"
            tone="glass"
            onPress={() => router.push('/(app)/fund')}
          />
          <PillButton
            label="Convert"
            icon="swap-horizontal"
            tone="dark"
            onPress={() => router.push('/(app)/convert' as Href)}
          />
        </View>

        {!isMd ? <PagerFooter view={view} onGo={scrollTo} /> : null}
      </View>
    </LinearGradient>
  );

  const usdCard = (
    <ImageBackground
      source={USD_WALLET_BG}
      resizeMode="cover"
      imageStyle={styles.usdImage}
      style={[styles.card, styles.usdCard, isMd && themeStyles.mdCard]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.08)', 'transparent']}
        locations={[0, 0.42, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <WalletCardShine intensity="soft" />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brand}>ORYNO</Text>
            <Text style={styles.walletName}>USD Wallet</Text>
          </View>
          <Pressable
            onPress={() => setHidden((v) => !v)}
            style={[styles.eye, styles.eyeDark]}
            hitSlop={8}
            accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
            <Ionicons
              name={hidden ? 'eye-off' : 'eye'}
              size={13}
              color={Brand.white}
            />
          </Pressable>
        </View>

        <View>
          <Text style={[styles.available, { color: 'rgba(255,255,255,0.5)' }]}>
            Available balance
          </Text>
          <Text style={styles.balance} numberOfLines={1}>
            {maskBalance(hidden, usdFormatted)}
          </Text>
        </View>

        <View style={styles.actions}>
          <PillButton
            label="Fund"
            icon="add"
            tone="usd"
            onPress={() => router.push('/(app)/(tabs)/cards')}
          />
          <PillButton
            label="Convert"
            icon="swap-horizontal"
            tone="usdAlt"
            onPress={() =>
              router.push({
                pathname: '/(app)/convert',
                params: { direction: 'to_local' },
              } as unknown as Href)
            }
          />
        </View>

        {!isMd ? <PagerFooter view={view} onGo={scrollTo} /> : null}
      </View>
    </ImageBackground>
  );

  if (isMd) {
    return (
      <View style={styles.mdRow}>
        <View style={styles.mdCol}>{localCard}</View>
        <View style={styles.mdCol}>{usdCard}</View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={pagerRef}
      horizontal
      decelerationRate="fast"
      snapToInterval={stride}
      snapToAlignment="start"
      disableIntervalMomentum
      bounces={false}
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ width: cardWidth }}
      contentContainerStyle={{ width: stride * 2 - SLIDE_GAP, gap: SLIDE_GAP }}>
      <View style={{ width: cardWidth }}>{localCard}</View>
      <View style={{ width: cardWidth }}>{usdCard}</View>
    </ScrollView>
  );
}

function makeThemeStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    mdCard: { flex: 1 },
  });
}

const styles = StyleSheet.create({
  skeleton: {
    height: 148,
    backgroundColor: 'rgba(142,142,147,0.18)',
  },
  mdRow: { flexDirection: 'row', gap: SLIDE_GAP },
  mdCol: { flex: 1, minWidth: 0 },
  card: {
    overflow: 'hidden',
  },
  usdCard: {
    backgroundColor: '#0A0A0C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  usdImage: {},
  body: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brand: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
  walletName: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.white,
    letterSpacing: 0.2,
  },
  available: {
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 1.1,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  balance: {
    marginTop: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Brand.white,
    letterSpacing: -0.4,
  },
  eye: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  eyeDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  actions: { flexDirection: 'row', gap: 14 },
  pillBtn: {
    flex: 1,
    height: 32,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillGlass: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pillDarkBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pillUsd: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pillUsdAlt: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pillBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.white,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 16,
    backgroundColor: Brand.white,
  },
  swipeHint: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
});
