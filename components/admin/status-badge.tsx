import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

function tone(status: string, muted: string, mutedFg: string) {
  const s = status.toLowerCase();
  if (['live', 'active', 'approved', 'completed', 'success', 'verified'].some((k) => s.includes(k))) {
    return { bg: 'rgba(52,199,89,0.12)', fg: Brand.success };
  }
  if (['pending', 'review', 'processing', 'draft'].some((k) => s.includes(k))) {
    return { bg: 'rgba(255,204,0,0.16)', fg: '#B8860B' };
  }
  if (['failed', 'rejected', 'suspended', 'frozen', 'inactive', 'error'].some((k) => s.includes(k))) {
    return { bg: 'rgba(255,59,48,0.12)', fg: Brand.error };
  }
  return { bg: muted, fg: mutedFg };
}

export function StatusBadge({ status }: { status: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: 'flex-start',
          borderRadius: Radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        text: { fontSize: 11, fontWeight: '700' },
      }),
    [],
  );
  const t = tone(status, colors.muted, colors.mutedForeground);

  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
}
