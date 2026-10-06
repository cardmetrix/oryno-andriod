import type { NativeStackNavigationOptions } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Shared motion presets. Background comes from React Navigation theme
 * (`colors.background`) so light/dark mode applies — do not hardcode white.
 *
 * iOS uses the native edge-swipe push. A full-screen gesture falls back to
 * `simple_push` on iOS 18 and below, which drops the parallax and feels stiff.
 * Android uses the iOS-style slide so the previous screen moves with the new one.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: Platform.select({
    ios: 'default',
    android: 'ios_from_right',
    default: 'ios_from_right',
  }),
  gestureEnabled: true,
  fullScreenGestureEnabled: false,
  animationMatchesGesture: true,
  /** Forward replaces (invoice created → detail) should slide in, not pop. */
  animationTypeForReplace: 'push',
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
