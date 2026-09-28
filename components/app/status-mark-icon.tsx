import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';

export type StatusMark = 'Successful' | 'Pending' | 'Failed' | 'Reversed';

export function normalizeStatusMark(status: string): StatusMark {
  const s = status.toLowerCase();
  if (s === 'reversed') return 'Reversed';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'pending' || s === 'processing') return 'Pending';
  return 'Successful';
}

const ICONS: Record<
  StatusMark,
  keyof typeof Ionicons.glyphMap
> = {
  Successful: 'checkmark-circle-outline',
  Pending: 'time-outline',
  Failed: 'close-circle-outline',
  Reversed: 'refresh-circle-outline',
};

/** Large status glyph used on receipts and service result modals (website parity). */
export function StatusMarkIcon({
  status,
  color = Brand.orange,
  style,
}: {
  status: string;
  color?: string;
  style?: ViewStyle;
}) {
  const mark = normalizeStatusMark(status);
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name={ICONS[mark]} size={56} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
