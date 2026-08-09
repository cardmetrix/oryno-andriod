import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

type Props = {
  /** Show “Getting ready…” under the tagline (default true). */
  showStatus?: boolean;
};

function GettingReadyDots() {
  const [count, setCount] = useState(1);
  const direction = useRef<1 | -1>(1);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((prev) => {
        let next = prev + direction.current;
        if (next >= 3) {
          next = 3;
          direction.current = -1;
        } else if (next <= 1) {
          next = 1;
          direction.current = 1;
        }
        return next;
      });
    }, 320);
    return () => clearInterval(id);
  }, []);

  return (
    <Text style={styles.status} accessibilityLabel="Getting ready">
      Getting ready{'.'.repeat(count)}
    </Text>
  );
}

function FloatingOrb({
  size,
  top,
  left,
  delay,
  opacity = 0.18,
}: {
  size: number;
  top: `${number}%` | number;
  left: `${number}%` | number;
  delay: number;
  opacity?: number;
}) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, drift]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [0, -18]) },
      { translateX: interpolate(drift.value, [0, 1], [0, 10]) },
      { scale: interpolate(drift.value, [0, 1], [1, 1.08]) },
    ],
    opacity,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top,
          left,
        },
        style,
      ]}
    />
  );
}

function ProgressRail() {
  const progress = useSharedValue(0.08);
  const railWidth = useSharedValue(240);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 2200,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(12, railWidth.value * progress.value),
  }));

  return (
    <View
      style={styles.rail}
      onLayout={(e) => {
        railWidth.value = e.nativeEvent.layout.width;
      }}>
      <Animated.View style={[styles.railFill, fillStyle]} />
    </View>
  );
}

/** Full-screen orange fintech splash used while auth / session sync loads. */
export function SplashLoading({ showStatus = true }: Props) {
  const logoScale = useSharedValue(0.72);
  const logoOpacity = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 420 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 160 });
    pulse.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    ring.value = withDelay(
      280,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [logoOpacity, logoScale, pulse, ring]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      {
        scale: logoScale.value * interpolate(pulse.value, [0, 1], [1, 1.035]),
      },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.2, 1], [0.45, 0.28, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.92, 1.55]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.7]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.12]) }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FF8A2B', Brand.orange, '#E24F00', '#C74300']}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft fintech mesh accents */}
      <FloatingOrb size={220} top="-6%" left="-18%" delay={0} opacity={0.16} />
      <FloatingOrb size={160} top="12%" left="68%" delay={400} opacity={0.14} />
      <FloatingOrb size={120} top="70%" left="-8%" delay={800} opacity={0.12} />
      <FloatingOrb size={90} top="78%" left="72%" delay={200} opacity={0.15} />

      <View pointerEvents="none" style={styles.gridOverlay} />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.topBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.topBadgeText}>SECURE WALLET NETWORK</Text>
        </Animated.View>

        <View style={styles.center}>
          <View style={styles.logoStage}>
            <Animated.View style={[styles.pulseRing, ringStyle]} />
            <Animated.View style={[styles.logoGlow, glowStyle]} />
            <Animated.View style={[styles.logoWell, logoStyle]}>
              <Image
                source={require('@/assets/images/oryno-icon.png')}
                style={styles.logo}
                contentFit="cover"
              />
            </Animated.View>
          </View>

          <Animated.Text
            entering={FadeInDown.delay(220).duration(480).springify().damping(16)}
            style={styles.brand}>
            ORYNO
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(340).duration(420)}
            style={styles.tagline}>
            One App. Endless Possibilities
          </Animated.Text>

          <Animated.View
            entering={FadeInUp.delay(480).duration(420)}
            style={styles.chips}>
            {['Instant', 'Protected', 'Africa'].map((label) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(620).duration(400)}
            style={styles.progressWrap}>
            <ProgressRail />
            {showStatus ? <GettingReadyDots /> : (
              <Text style={styles.status}>Powering your money moment</Text>
            )}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(700).duration(400)} style={styles.footer}>
          <Text style={styles.footerBrand}>Built for modern Africa</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.orange,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  orb: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.07,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.35)',
    // subtle diagonal sheen via layered borders isn't ideal; keep light veil
  },
  topBadge: {
    alignSelf: 'center',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFE0B8',
  },
  topBadgeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 36,
  },
  logoStage: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  logoWell: {
    width: 104,
    height: 104,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: Brand.orange,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  logo: { width: '100%', height: '100%', borderRadius: 999,},
  brand: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 3.2,
    color: Brand.white,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.2,
  },
  chips: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipText: {
    color: Brand.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  progressWrap: {
    marginTop: 28,
    width: '78%',
    maxWidth: 280,
    alignItems: 'center',
    gap: 12,
  },
  rail: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  railFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Brand.white,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    minWidth: 160,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 22,
  },
  footerBrand: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
});
