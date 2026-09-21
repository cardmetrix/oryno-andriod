import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Peak opacity of the highlight (local cards are brighter). */
  intensity?: 'bright' | 'soft';
};

/**
 * Soft diagonal light sweep — website-style shine on wallet cards.
 */
export function WalletCardShine({ intensity = 'bright' }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1800,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
        withDelay(2400, withTiming(1, { duration: 0 })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [progress]);

  const style = useAnimatedStyle(() => {
    // Move from off-left (−40%) to off-right (140%) of a ~320pt card.
    const travel = -130 + progress.value * 420;
    const fade =
      progress.value < 0.08
        ? progress.value / 0.08
        : progress.value > 0.92
          ? (1 - progress.value) / 0.08
          : 1;

    return {
      opacity: fade,
      transform: [{ translateX: travel }, { skewX: '-18deg' }],
    };
  });

  const colors =
    intensity === 'bright'
      ? ([
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.08)',
          'rgba(255,255,255,0.25)',
          'rgba(255,255,255,0.08)',
          'rgba(255,255,255,0)',
        ] as const)
      : ([
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.02)',
          'rgba(255,255,255,0.1)',
          'rgba(255,255,255,0.02)',
          'rgba(255,255,255,0)',
        ] as const);

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 110,
    left: 0,
  },
  gradient: {
    flex: 1,
    width: '100%',
  },
});
