import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

/**
 * Shared motion presets. Background comes from React Navigation theme
 * (`colors.background`) so light/dark mode applies — do not hardcode white.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 320,
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
};

/** Soft cross-fade between auth steps / root groups. */
export const fadeScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 280,
  gestureEnabled: true,
};

/** Fast fade for admin tab-style navigation. */
export const adminStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 200,
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
};

/** Slightly snappier push for admin secondary screens (from More). */
export const adminPushScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 240,
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
};

/** Bottom sheet style for money / utility sheets. */
export const modalScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'modal',
  animation: 'slide_from_bottom',
  animationDuration: 360,
  gestureEnabled: true,
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
};
