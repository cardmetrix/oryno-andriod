import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAppTheme } from '@/context/theme-context';

type Props = {
  label: string;
  href: string;
  index?: number;
  /** Home quick actions use `sm`; services catalog matches website with `md`. */
  size?: 'sm' | 'md';
  children: ReactNode;
};

/**
 * Matches website `ServiceActionCard`: orange gradient circle + bold label.
 */
export function ServiceActionCard({
  label,
  href,
  index = 0,
  size = 'sm',
  children,
}: Props) {
  const { colors } = useAppTheme();
  const circle = size === 'md' ? 56 : 44;
  const labelSize = size === 'md' ? 13 : 11;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 45, 350)).duration(400)}
      style={styles.wrap}>
      <Pressable
        onPress={() => router.push(href as never)}
        style={({ pressed }) => [styles.press, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <LinearGradient
          colors={['#FF6A00', '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.iconCircle, { width: circle, height: circle }]}>
          {children}
        </LinearGradient>
        <Text
          style={[styles.label, { color: colors.foreground, fontSize: labelSize }]}
          numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  press: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  iconCircle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
    lineHeight: 16,
  },
});
