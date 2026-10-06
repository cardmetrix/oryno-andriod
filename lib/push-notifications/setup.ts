import { Platform } from 'react-native';

import { pushDebug } from './debug';
import { isExpoGo } from './expo-go';
import { getNotificationsModule } from './module';

export { isExpoGo } from './expo-go';

export function configurePushNotificationHandler(): void {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android' && isExpoGo()) {
    pushDebug(
      'warn',
      'setup',
      'Expo Go on Android cannot load expo-notifications. Use a development build for push.',
    );
    return;
  }

  if (isExpoGo()) {
    pushDebug(
      'warn',
      'setup',
      'Expo Go detected — remote push is limited. Prefer a development build for full push.',
    );
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    pushDebug('warn', 'setup', 'expo-notifications unavailable — skipping handler setup');
    return;
  }

  try {
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
