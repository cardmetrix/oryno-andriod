import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

type Props = {
  /** Show loading progress under the feature cards (default true). */
  showStatus?: boolean;
};

const FEATURES = [
  {
    key: 'instant',
    title: 'Instant',
    body: 'Pay, top up and get more in seconds',
    icon: 'flash' as const,
  },
  {
    key: 'secure',
    title: 'Secure',
    body: 'Advanced security to protect you',
    icon: 'shield-outline' as const,
  },
  {
    key: 'reliable',
    title: 'Reliable',
    body: 'Trusted by thousands of users',
    icon: 'ribbon-outline' as const,
  },
];

function ProgressBlock({ showStatus }: { showStatus: boolean }) {
  const progress = useSharedValue(0.08);
  const [pct, setPct] = useState(8);
  const railWidth = useSharedValue(260);

  useEffect(() => {
    progress.value = withTiming(0.92, {
      duration: 1300,
      easing: Easing.out(Easing.cubic),
    });
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / 1300);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(8 + eased * 84));
    }, 80);
    return () => clearInterval(id);
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(12, railWidth.value * progress.value),
  }));

  if (!showStatus) return null;

  return (
    <Animated.View entering={FadeIn.delay(450).duration(210)} style={styles.progressBlock}>
      <Text style={styles.preparing}>Preparing your experience…</Text>
      <View style={styles.progressRow}>
        <View
          style={styles.rail}
          onLayout={(e) => {
            railWidth.value = e.nativeEvent.layout.width;
          }}>
          <Animated.View style={[styles.railFill, fillStyle]} />
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Full-screen splash: designed background art + brand/copy overlay
 * matching the ORYNO welcome layout.
 */
export function SplashLoading({ showStatus = true }: Props) {
  return (
    <View style={styles.root}>
      <Image
        source={require('@/assets/images/oryno-splash-bg.png')}
        style={styles.background}
        contentFit="cover"
        contentPosition="center"
        priority="high"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Animated.View
            entering={FadeInLeft.duration(260).springify().damping(16)}
            style={styles.brandRow}>
            <Animated.View entering={ZoomIn.delay(40).duration(210).springify().damping(14)}>
              <View style={styles.brandMark}>
                <Image
                  source={require('@/assets/images/oryno-icon.png')}
                  style={styles.brandMarkImage}
                  contentFit="cover"
                />
              </View>
            </Animated.View>
            <Animated.Text
              entering={FadeInLeft.delay(60).duration(240)}
              style={styles.brandName}>
              ORYNO
            </Animated.Text>
          </Animated.View>

          <View style={styles.headlineBlock}>
            <Animated.Text
              entering={FadeInDown.delay(100).duration(260).springify().damping(17)}
              style={styles.headlineDark}>
              Your Digital World, 
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(170).duration(280).springify().damping(17)}
              style={styles.headlineOrange}>
              Simplified.
            </Animated.Text>
            <Animated.Text
              entering={FadeInUp.delay(240).duration(250)}
              style={styles.subcopy}>
              Pay, top up, sell gift cards and more.{'\n'}
              All in one secure platform.
            </Animated.Text>
          </View>

          <View style={styles.bottomStack}>
            <View style={styles.featureRow}>
              {FEATURES.map((item, index) => (
                <Animated.View
                  key={item.key}
                  entering={FadeInUp.delay(310 + index * 55)
                    .duration(260)
                    .springify()
                    .damping(16)}
                  style={styles.featureCard}>
                  <Animated.View
                    entering={ZoomIn.delay(350 + index * 55)
                      .duration(210)
                      .springify()
                      .damping(12)}
                    style={styles.featureIcon}>
                    <Ionicons name={item.icon} size={18} color={Brand.orange} />
                  </Animated.View>
                  <Animated.Text
                    entering={FadeIn.delay(380 + index * 55).duration(180)}
                    style={styles.featureTitle}>
                    {item.title}
                  </Animated.Text>
                  <Animated.Text
                    entering={FadeIn.delay(410 + index * 55).duration(180)}
                    style={styles.featureBody}>
                    {item.body}
                  </Animated.Text>
                </Animated.View>
              ))}
            </View>

          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  background: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Brand.orange,
    borderWidth: 1.5,
    borderColor: 'rgba(255,106,0,0.25)',
  },
  brandMarkImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: Brand.orange,
  },
  headlineBlock: {
    marginTop: 36,
    maxWidth: 340,
  },
  headlineDark: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: '#1C1C1E',
    lineHeight: 40,
  },
  headlineOrange: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: Brand.orange,
    lineHeight: 40,
  },
  subcopy: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: '#6B7280',
  },
  bottomStack: {
    marginTop: 'auto',
    gap: 16,
    paddingBottom: 168,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
  },
  featureCard: {
    flex: 1,
    minHeight: 148,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,106,0,0.12)',
    shadowColor: '#FF6A00',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,106,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  featureBody: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
  },
  progressWrap: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  progressBlock: {
    width: '100%',
    gap: 10,
  },
  preparing: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rail: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,106,0,0.16)',
    overflow: 'hidden',
  },
  railFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Brand.orange,
  },
  pct: {
    minWidth: 36,
    textAlign: 'right',
    color: Brand.orange,
    fontSize: 13,
    fontWeight: '800',
  },
});
