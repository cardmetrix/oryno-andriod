import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

/**
 * Shared motion presets. Background comes from React Navigation theme
 * (`colors.background`) so light/dark mode applies — do not hardcode white.
 *
 * Prefer platform-native push on iOS (`default`) — it uses UINavigationController
 * and feels smoother than JS-timed `slide_from_right`. Android keeps an explicit
 * horizontal slide. `animationDuration` only applies to fade / simple_push /
 * slide_from_bottom on iOS (not slide_from_right).
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: Platform.select({
    ios: 'default',
    android: 'slide_from_right',
    default: 'slide_from_right',
  }),
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
  /** Freeze inactive screens so stack pushes stay smooth under load. */
  freezeOnBlur: true,
};

/** Soft cross-fade between auth steps / root groups. */
export const fadeScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 220,
  gestureEnabled: true,
  freezeOnBlur: true,
};

/** Fast fade for admin primary tabs (Overview / Users / KYC / Wallets / More). */
export const adminStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 160,
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
  freezeOnBlur: true,
};

/** Snappy push for admin secondary screens (from More). */
export const adminPushScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: Platform.select({
    ios: 'default',
    android: 'slide_from_right',
    default: 'slide_from_right',
  }),
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
  freezeOnBlur: true,
};

/** Bottom sheet style for money / utility sheets. */
export const modalScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'modal',
  animation: 'slide_from_bottom',
  animationDuration: 320,
  gestureEnabled: true,
  freezeOnBlur: true,
};

/** Native form sheet (modern bottom sheet with detents + grabber). */
export const formSheetScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'formSheet',
  gestureEnabled: true,
  sheetAllowedDetents: [0.58, 0.92],
  sheetInitialDetentIndex: 0,
  sheetGrabberVisible: true,
  sheetCornerRadius: 28,
  sheetLargestUndimmedDetentIndex: 'none',
  freezeOnBlur: true,
};
