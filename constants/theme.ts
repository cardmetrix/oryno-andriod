/**
 * ORYNO brand + theme tokens — ported from oryno-website/app/globals.css
 */

import { Platform } from 'react-native';

export const Brand = {
  orange: '#FF6A00',
  orangeSoft: '#FF8C42',
  orangeMuted: 'rgba(255, 106, 0, 0.12)',
  charcoal: '#1C1C1E',
  white: '#FFFFFF',
  grayLight: '#F5F5F7',
  grayMedium: '#8E8E93',
  grayDivider: '#E5E5EA',
  success: '#34C759',
  warning: '#FFCC00',
  error: '#FF3B30',
} as const;

export const Radius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 24,
  card: 28,
  phone: 32,
} as const;

export type ThemePreference = 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

/** Semantic surface + brand tokens for light/dark (matches website globals.css). */
export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  danger: string;
  success: string;
  warning: string;
  orange: string;
  orangeSoft: string;
  orangeMuted: string;
  /** Alias of foreground — replaces Brand.charcoal in themed UI */
  charcoal: string;
  /** Always pure white — text/icons on orange fills */
  white: string;
  /** Alias of muted — replaces Brand.grayLight */
  grayLight: string;
  /** Alias of mutedForeground — replaces Brand.grayMedium */
  grayMedium: string;
  /** Alias of border — replaces Brand.grayDivider */
  grayDivider: string;
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  foreground: '#1C1C1E',
  card: '#FFFFFF',
  muted: '#F5F5F7',
  mutedForeground: '#8E8E93',
  border: '#E5E5EA',
  input: '#E5E5EA',
  primary: Brand.orange,
  primaryForeground: Brand.white,
  tint: Brand.orange,
  icon: Brand.grayMedium,
  tabIconDefault: Brand.grayMedium,
  tabIconSelected: Brand.orange,
  danger: Brand.error,
  success: Brand.success,
  warning: Brand.warning,
  orange: Brand.orange,
  orangeSoft: Brand.orangeSoft,
  orangeMuted: 'rgba(255, 106, 0, 0.12)',
  charcoal: '#1C1C1E',
  white: Brand.white,
  grayLight: '#F5F5F7',
  grayMedium: '#8E8E93',
  grayDivider: '#E5E5EA',
};

const darkColors: ThemeColors = {
  background: '#0F0F12',
  foreground: '#F4F4F5',
  card: '#17171B',
  muted: '#17171B',
  mutedForeground: '#A1A1AA',
  border: '#2A2A2E',
  input: '#2A2A2E',
  primary: Brand.orange,
  primaryForeground: Brand.white,
  tint: Brand.orangeSoft,
  icon: '#A1A1AA',
  tabIconDefault: '#A1A1AA',
  tabIconSelected: Brand.orangeSoft,
  danger: Brand.error,
  success: Brand.success,
  warning: Brand.warning,
  orange: Brand.orange,
  orangeSoft: Brand.orangeSoft,
  /** color-mix(orange 22%, #141416) approx */
  orangeMuted: 'rgba(255, 106, 0, 0.22)',
  charcoal: '#F4F4F5',
  white: Brand.white,
  grayLight: '#1C1C1F',
  grayMedium: '#A1A1AA',
  grayDivider: '#2A2A2E',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
} as const;

export function getThemeColors(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    rounded: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'System',
    rounded: 'System',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    rounded: "'SF Pro Rounded', system-ui, sans-serif",
    mono: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});
