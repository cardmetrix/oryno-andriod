import { Colors, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors,
) {
  const { scheme } = useAppTheme();
  const colorFromProps = props[scheme];
  if (colorFromProps) return colorFromProps;
  return Colors[scheme][colorName];
}
