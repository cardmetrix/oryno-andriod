import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  /** 0–1 pull progress (legacy); prefer `pull` shared value to avoid re-renders. */
  progress?: number;
  /** Live pull distance from OrynoPullToRefresh (UI-thread). */
  pull?: SharedValue<number>;
  /** Pull distance that equals full progress. */
  threshold?: number;
  refreshing?: boolean;
  size?: number;
};

/**
 * Custom pull-to-refresh indicator: ORYNO mark + orange arc
 * (mirrors website `OrynoRefreshIcon`).
 */
export function OrynoRefreshIcon({
  progress = 0,
  pull,
  threshold = 72,
  refreshing = false,
  size = 40,
}: Props) {
  const { colors } = useAppTheme();
  const gradId = 'orynoRefreshGrad';
  const staticP = Math.max(0, Math.min(1, progress));
  const iconSize = Math.round(size * 0.52);
  const stroke = Math.max(2.5, size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Fixed arc while pulling — avoids SVG remount / dasharray thrash each frame.
  const arcLen = refreshing ? c * 0.72 : c * 0.45;

  const spin = useSharedValue(0);
  const pulse = useSharedValue(1);
  const visible = useSharedValue(refreshing || staticP > 0.02 ? 1 : 0);

  useAnimatedReaction(
    () => {
      if (refreshing) return 1;
      if (pull) return pull.value > 4 ? 1 : 0;
      return staticP > 0.02 ? 1 : 0;
    },
    (v) => {
      visible.value = v;
    },
    [pull, refreshing, staticP],
  );

  useAnimatedReaction(
    () => {
      if (refreshing || !pull) return -1;
      return Math.min(1, pull.value / threshold) * 270;
    },
    (deg) => {
      if (deg < 0 || refreshing) return;
      spin.value = deg;
    },
    [pull, refreshing, threshold],
  );

  useEffect(() => {
    if (refreshing) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(360, { duration: 850, easing: Easing.linear }),
        -1,
        false,
      );
      pulse.value = withRepeat(
        withTiming(1.06, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return () => {
        cancelAnimation(spin);
        cancelAnimation(pulse);
      };
    }
    cancelAnimation(spin);
    cancelAnimation(pulse);
    if (!pull) {
      spin.value = staticP * 270;
    }
    pulse.value = withTiming(1, { duration: 160 });
  }, [pull, pulse, refreshing, spin, staticP]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value - 90}deg` }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const rootStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
  }));

  return (
    <Animated.View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          shadowOpacity: refreshing ? 0.28 : 0.18,
        },
        rootStyle,
      ]}
      pointerEvents="none">
      <View
        style={[
          styles.glow,
          {
            backgroundColor: Brand.orangeMuted,
            opacity: refreshing ? 1 : 0.55,
          },
        ]}
      />

      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={Brand.orange}
          strokeWidth={stroke}
          opacity={0.2}
        />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, arcStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={Brand.orange} stopOpacity="0.05" />
              <Stop offset="55%" stopColor={Brand.orange} stopOpacity="0.55" />
              <Stop offset="100%" stopColor={Brand.orange} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${c}`}
            strokeDashoffset={0}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.mark,
          iconStyle,
          {
            width: iconSize,
            height: iconSize,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}>
        <Image
          source={require('@/assets/images/oryno-icon.png')}
          style={styles.markImage}
          contentFit="cover"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.orange,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    margin: -6,
    borderRadius: 999,
  },
  mark: {
    borderRadius: 999,
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  markImage: { width: '100%', height: '100%' },
});
