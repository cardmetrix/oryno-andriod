import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ANDROID_ALERTS_CHANNEL_ID, ANDROID_DEFAULT_CHANNEL_ID } from './constants';
import { pushDebug } from './debug';
import { ensureAndroidNotificationChannels } from './register';

export async function showLocalNotification(input: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: 'default' | 'alerts';
}): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await ensureAndroidNotificationChannels();
  }

  const channelId =
    input.channel === 'alerts' ? ANDROID_ALERTS_CHANNEL_ID : ANDROID_DEFAULT_CHANNEL_ID;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound: 'default',
        data: input.data ?? {},
        priority: Notifications.AndroidNotificationPriority.HIGH,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null,
    });
    pushDebug('success', 'local', 'Local notification shown', { title: input.title });
  } catch (err) {
    pushDebug('error', 'local', 'Failed to show notification', err);
  }
}

/** Mirror an in-app inbox item as a device banner (Growvest-style bridge). */
export async function mirrorInAppNotification(input: {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  type?: string;
}): Promise<void> {
  const title = input.title.startsWith('ORYNO') ? input.title : `ORYNO · ${input.title}`;
  await showLocalNotification({
    title,
    body: input.body,
    channel: 'alerts',
    data: {
      notificationId: input.id,
      href: input.href ?? '/notifications',
      type: input.type ?? 'system',
    },
  });
}
