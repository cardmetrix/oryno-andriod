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
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { WalletCardSkeleton } from '@/components/ui/skeletons';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useWallet } from '@/hooks/use-wallet';
import { maskBalance } from '@/lib/format';

const LOCAL_HINT: Record<string, string> = {
  NG: 'Use your NGN balance for airtime, data, bills, betting and other Nigerian services.',
  GH: 'Use your GHS balance for airtime, data, bills, betting and other Ghanaian services.',
  KE: 'Use your KES balance for airtime, data, bills, betting and other Kenyan services.',
  ZA: 'Use your ZAR balance for airtime, data, bills and other South African services.',
};

const GAP = 12;
const MD_BREAKPOINT = 768;
const USD_WALLET_BG = require('@/assets/images/usd-wallet-card-bg.png');

type Props = {
  loading?: boolean;
};

function ActionButton({
  label,
  icon,
  variant,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: 'solid' | 'ghost';
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        onPress={onPress}
        style={[
          styles.actionBtn,
          variant === 'solid' ? styles.actionSolid : styles.actionGhost,
        ]}>
        <Ionicons
          name={icon}
          size={15}
          color={Brand.white}
        />
        <Text style={styles.actionText}>{label}</Text>
      </Pressable>
    </Animated.View>
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
          onPress={() => onGo('local')}
          style={[styles.dot, view === 'local' && styles.dotActive]}
        />
        <Pressable
          onPress={() => onGo('usd')}
          style={[styles.dot, view === 'usd' && styles.dotActive]}
        />
      </View>
      <Pressable onPress={() => onGo(view === 'local' ? 'usd' : 'local')}>
        <Animated.Text
          key={view}
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(100)}
          style={styles.swipeHint}>
          {view === 'local' ? 'Swipe for USD ›' : '‹ Local wallet'}
        </Animated.Text>
      </Pressable>
    </View>
  );
}

/** Dashboard wallets: one-at-a-time swipe; both side-by-side from md. */
export function DashboardWalletCarousel({ loading }: Props) {
  const { colors } = useAppTheme();
  const themeStyles = useMemo(() => makeThemeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isMd = width >= MD_BREAKPOINT;
  const cardWidth = width - 32; // Screen horizontal padding ~16 each side
  const stride = cardWidth + GAP;
  const { data, loading: walletLoading } = useWallet();
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<'local' | 'usd'>('local');
  const pagerRef = useRef<ScrollView>(null);

  if ((loading || walletLoading) && !data) {
    return <WalletCardSkeleton />;
  }

  const countryCode = data?.country?.code ?? data?.user?.countryCode ?? 'NG';
  const flag = data?.country?.flagEmoji ?? '';
  const localCurrency = data?.primary.currency ?? data?.country?.currency ?? 'NGN';
  const localFormatted = data?.primary.balanceFormatted ?? `${localCurrency} 0.00`;
  const usdFormatted = data?.usd?.balanceFormatted ?? '$0.00';
  const hint =
    LOCAL_HINT[countryCode] ??
    `Use your ${localCurrency} balance for local services.`;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (isMd) return;
    const x = e.nativeEvent.contentOffset.x;
    setView(x > stride * 0.4 ? 'usd' : 'local');
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
      style={[styles.card, styles.localShadow, isMd && themeStyles.mdCard]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>ORYNO</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>LOCAL WALLET</Text>
        </View>
      </View>

      <Text style={styles.title}>
        {localCurrency} Wallet {flag}
      </Text>

      <View style={styles.balanceRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.available}>AVAILABLE BALANCE</Text>
          <Text style={styles.balance} numberOfLines={1}>
            {maskBalance(hidden, localFormatted)}
          </Text>
        </View>
        <Pressable
          onPress={() => setHidden((v) => !v)}
          style={styles.eye}
          hitSlop={8}
          accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
          <Ionicons
            name={hidden ? 'eye-off' : 'eye'}
            size={16}
            color={Brand.white}
          />
        </Pressable>
      </View>

      <Text style={styles.hint}>{hint}</Text>

      <View style={styles.actions}>
        <ActionButton
          label="Fund Wallet"
          icon="add"
          variant="solid"
          onPress={() => router.push('/(app)/fund')}
        />
        <ActionButton
          label="Convert to USD"
          icon="swap-horizontal"
          variant="ghost"
          onPress={() => router.push('/(app)/convert' as Href)}
        />
      </View>

      {!isMd ? <PagerFooter view={view} onGo={scrollTo} /> : null}
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
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.18)', 'transparent']}
        locations={[0, 0.42, 0.78]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <Text style={styles.brand}>ORYNO</Text>
        <View style={[styles.pill, styles.pillDark]}>
          <Text style={styles.pillText}>USD WALLET</Text>
        </View>
      </View>

      <Text style={styles.title}>USD Wallet 🌐</Text>

      <View style={styles.balanceRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.available, { opacity: 0.65 }]}>AVAILABLE BALANCE</Text>
          <Text style={styles.balance} numberOfLines={1}>
            {maskBalance(hidden, usdFormatted)}
          </Text>
        </View>
        <Pressable
          onPress={() => setHidden((v) => !v)}
          style={[styles.eye, styles.eyeDark]}
          hitSlop={8}
          accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
          <Ionicons
            name={hidden ? 'eye-off' : 'eye'}
            size={16}
            color={Brand.white}
          />
        </Pressable>
      </View>

      <Text style={[styles.hint, { opacity: 0.75 }]}>
        Use your USD balance for gift cards, international virtual numbers and more.
      </Text>

      <View style={styles.actions}>
        <ActionButton
          label="Cards"
          icon="card-outline"
          variant="solid"
          onPress={() => router.push('/(app)/(tabs)/cards')}
        />
        <ActionButton
          label="Convert"
          icon="swap-horizontal"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/(app)/convert',
              params: { direction: 'to_local' },
            } as unknown as Href)
          }
        />
      </View>

      {!isMd ? <PagerFooter view={view} onGo={scrollTo} /> : null}
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
    <View style={styles.wrap}>
      <ScrollView
        ref={pagerRef}
        horizontal
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ width: cardWidth }}
        contentContainerStyle={{ width: stride * 2 - GAP, gap: GAP }}>
        <View style={{ width: cardWidth }}>{localCard}</View>
        <View style={{ width: cardWidth }}>{usdCard}</View>
      </ScrollView>
    </View>
  );
}

function makeThemeStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    mdCard: { flex: 1, minHeight: 200 },
  });
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 2 },
  mdRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  mdCol: { flex: 1, minWidth: 0 },
  card: {
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
    minHeight: 210,
    gap: 8,
  },
  localShadow: {},
  usdCard: {
    backgroundColor: '#0A0A0C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  usdImage: { borderRadius: 18 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.9)',
  },
  pill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.95)',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.white,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  available: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  balance: {
    fontSize: 22,
    fontWeight: '900',
    color: Brand.white,
    letterSpacing: -0.4,
  },
  eye: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  eyeDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hint: {
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    height: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionSolid: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionGhost: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.white,
  },
  actionTextDark: { color: Brand.white },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 18,
    backgroundColor: Brand.white,
  },
  swipeHint: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
});
