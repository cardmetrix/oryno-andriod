import { Platform } from 'react-native';

import { isExpoGo } from './expo-go';

export type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * Safely load `expo-notifications`.
 *
 * On Android Expo Go, merely importing the package throws because its
 * DevicePushTokenAutoRegistration side-effect calls remote-push APIs that
 * were removed from Expo Go in SDK 53. Skip the import entirely there.
 */
export function getNotificationsModule(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (Platform.OS === 'android' && isExpoGo()) {
    cached = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function areNativeNotificationsAvailable(): boolean {
  return getNotificationsModule() !== null;
}
