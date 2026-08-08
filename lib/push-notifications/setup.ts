import { Platform } from 'react-native';

import { pushDebug } from './debug';

/** True when running inside Expo Go (remote push limited / unavailable on Android). */
export function isExpoGo() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      appOwnership?: string | null;
      executionEnvironment?: string;
    };
    return (
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === 'storeClient'
    );
  } catch {
    return false;
  }
}

export function configurePushNotificationHandler(): void {
  if (Platform.OS === 'web') return;

  if (isExpoGo()) {
    pushDebug(
      'warn',
      'setup',
      'Expo Go detected — remote push is limited. Prefer a development build for full push.',
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    pushDebug('info', 'setup', 'Configuring foreground notification handler');
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        pushDebug('info', 'foreground', 'Presenting notification', {
          title: notification.request.content.title,
        });
        return {
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
  } catch (error) {
    pushDebug('error', 'setup', 'Failed to configure push handler', error);
  }
}
