import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  /** 0–1 pull progress; when refreshing, treat as spinning. */
  progress?: number;
  refreshing?: boolean;
  size?: number;
};

/**
 * Custom pull-to-refresh indicator: ORYNO mark + orange arc
 * (mirrors website `OrynoRefreshIcon`).
 */
export function OrynoRefreshIcon({
  progress = 0,
  refreshing = false,
  size = 40,
}: Props) {
  const { colors } = useAppTheme();
  const gradId = 'orynoRefreshGrad';
  const p = Math.max(0, Math.min(1, progress));
  const active = refreshing || p > 0.02;
  const iconSize = Math.round(size * 0.52);
  const stroke = Math.max(2.5, size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcLen = refreshing ? c * 0.72 : c * (0.18 + p * 0.54);

  const spin = useSharedValue(0);
  const pulse = useSharedValue(1);

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
    spin.value = p * 270;
    pulse.value = withTiming(1, { duration: 160 });
  }, [p, pulse, refreshing, spin]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value - 90}deg` }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowOpacity = refreshing ? 1 : 0.35 + p * 0.65;

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          opacity: active ? 1 : 0,
          shadowOpacity: active ? 0.28 : 0,
        },
      ]}
      pointerEvents="none">
      <View
        style={[
          styles.glow,
          {
            backgroundColor: Brand.orangeMuted,
            opacity: glowOpacity,
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
    </View>
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
