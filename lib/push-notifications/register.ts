import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { APP_VERSION } from '@/lib/app-version';

import { ANDROID_ALERTS_CHANNEL_ID, ANDROID_DEFAULT_CHANNEL_ID } from './constants';
import { formatPushError, pushDebug } from './debug';

export function getEasProjectId(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const fromConfig =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim();
  return null;
}

export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6A00',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(ANDROID_ALERTS_CHANNEL_ID, {
    name: 'ORYNO Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6A00',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  pushDebug('info', 'register', 'Starting registration', {
    platform: Platform.OS,
    isDevice: Device.isDevice,
  });

  if (Platform.OS === 'web') return null;

  if (!Device.isDevice) {
    pushDebug('warn', 'register', 'Push requires a physical device');
    return null;
  }

  await ensureAndroidNotificationChannels();

  let finalStatus = (await Notifications.getPermissionsAsync()).status;
  if (finalStatus !== 'granted') {
    finalStatus = (await Notifications.requestPermissionsAsync()).status;
  }

  if (finalStatus !== 'granted') {
    pushDebug('warn', 'register', `Permission not granted: ${finalStatus}`);
    return null;
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    pushDebug(
      'error',
      'register',
      'Missing EAS projectId — run `npx eas init` and set expo.extra.eas.projectId',
    );
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    pushDebug('success', 'register', 'Expo push token obtained');
    return token;
  } catch (err) {
    pushDebug('error', 'register', 'getExpoPushTokenAsync failed', formatPushError(err));
    return null;
  }
}

export async function syncPushTokenWithServer(token: string): Promise<void> {
  await api.post('/api/devices', {
    token,
    platform: Platform.OS,
    deviceId: Device.osInternalBuildId ?? Device.modelId ?? undefined,
    appVersion: Constants.expoConfig?.version ?? APP_VERSION,
  });
}

export async function unregisterPushToken(token?: string | null): Promise<void> {
  if (!token) {
    await api.delete('/api/devices?all=1').catch(() => undefined);
    return;
  }
  await api
    .delete(`/api/devices?token=${encodeURIComponent(token)}`)
    .catch(() => undefined);
}

let syncInFlight: Promise<string | null> | null = null;
let lastSyncedToken: string | null = null;
let lastSyncAt = 0;
const SYNC_COOLDOWN_MS = 60_000;

/** Get Expo token and persist it on the ORYNO backend (deduped). */
export async function registerPushToken(): Promise<string | null> {
  if (syncInFlight) return syncInFlight;

  const run = (async () => {
    const token = await registerForPushNotificationsAsync();
    if (!token) return null;

    // Skip repeat POSTs when the same token synced recently.
    if (token === lastSyncedToken && Date.now() - lastSyncAt < SYNC_COOLDOWN_MS) {
      return token;
    }

    try {
      await syncPushTokenWithServer(token);
      lastSyncedToken = token;
      lastSyncAt = Date.now();
      pushDebug('success', 'backend', 'Push token saved');
      return token;
    } catch (err) {
      // Transient network failures are common on mobile — warn, don't hard-error spam.
      const formatted = formatPushError(err);
      const isNetwork =
        /network request failed|failed to fetch|timed out|timeout/i.test(
          String(formatted.message ?? ''),
        );
      pushDebug(
        isNetwork ? 'warn' : 'error',
        'backend',
        'Failed to save push token',
        formatted,
      );
      return null;
    }
  })();

  syncInFlight = run;
  try {
    return await run;
  } finally {
    if (syncInFlight === run) syncInFlight = null;
  }
}

export async function setAppBadge(count: number) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // unsupported on some platforms
  }
}
