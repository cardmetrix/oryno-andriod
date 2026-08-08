import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
};

export function StatCard({ label, value, change, up }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {change ? (
        <Text style={[styles.change, up === false ? styles.down : styles.up]}>{change}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: '46%',
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 4,
    },
    label: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
    value: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    change: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    up: { color: Brand.success },
    down: { color: Brand.error },
  });
}
