import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

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
 * No enter animation / lingering press style — those flash during navigation.
 */
export function ServiceActionCard({
  label,
  href,
  size = 'sm',
  children,
}: Props) {
  const { colors } = useAppTheme();
  const circle = size === 'md' ? 56 : 44;
  const labelSize = size === 'md' ? 13 : 11;

  return (
    <Pressable
      onPress={() => {
        // Defer push so Pressable can unpress before the transition (no stuck click).
        requestAnimationFrame(() => {
          router.push(href as never);
        });
      }}
      style={styles.press}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(255,106,0,0.12)', borderless: true }}>
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
  );
}

const styles = StyleSheet.create({
  press: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  iconCircle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
