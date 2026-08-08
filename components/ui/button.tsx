import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && {
          backgroundColor: colors.orange,
          shadowColor: colors.orange,
          shadowOpacity: 0.28,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
        },
        isSecondary && { backgroundColor: colors.muted },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
        style,
      ]}>
      <Text
        style={[
          styles.label,
          isPrimary && { color: colors.white },
          isSecondary && { color: colors.foreground },
          variant === 'ghost' && { color: colors.orange },
          loading && styles.labelLoading,
        ]}>
        {loading ? `${title.replace(/\…$/, '')}…` : title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '700' },
  labelLoading: { opacity: 0.85 },
});
