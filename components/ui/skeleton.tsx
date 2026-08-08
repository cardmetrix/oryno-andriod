import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type SkeletonProps = {
  width?: number | `${number}%` | 'auto';
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Lighter bone for use on orange / dark surfaces */
  tone?: 'light' | 'dark' | 'onOrange';
};

export function Skeleton({
  width = '100%',
  height = 14,
  radius = Radius.sm,
  style,
  tone = 'light',
}: SkeletonProps) {
  const { colors, isDark } = useAppTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-180, 180]),
      },
    ],
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.35, 0.85, 0.35]),
  }));

  const base =
    tone === 'onOrange'
      ? 'rgba(255,255,255,0.22)'
      : tone === 'dark'
        ? 'rgba(255,255,255,0.08)'
        : isDark
          ? colors.muted
          : colors.grayLight;

  const highlight =
    tone === 'onOrange'
      ? ['transparent', 'rgba(255,255,255,0.45)', 'transparent']
      : tone === 'dark' || isDark
        ? ['transparent', 'rgba(255,255,255,0.12)', 'transparent']
        : ['transparent', 'rgba(255,255,255,0.85)', 'transparent'];

  return (
    <View
      style={[
        styles.bone,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: base,
          overflow: 'hidden',
        },
        style,
      ]}>
      <Animated.View style={[styles.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={highlight as [string, string, string]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {},
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: '70%',
  },
});
