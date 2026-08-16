import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
};

export function AdminCard({ title, children, action }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      {title || action ? (
        <View style={styles.head}>
          {title ? <Text style={styles.title}>{title}</Text> : <View style={{ flex: 1 }} />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginTop: 10,
      backgroundColor: colors.card,
      borderRadius: Radius.card,
      padding: 12,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 8,
    },
    title: { fontSize: 15, fontWeight: '700', color: colors.foreground, flex: 1 },
  });
}
