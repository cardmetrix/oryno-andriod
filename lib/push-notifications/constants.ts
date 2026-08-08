export const ANDROID_DEFAULT_CHANNEL_ID = 'default';
export const ANDROID_ALERTS_CHANNEL_ID = 'oryno-alerts';

export const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/** How often to poll inbox and mirror new items as local banners. */
export const NOTIFICATION_POLL_MS = 45_000;

export const STORAGE_KEYS = {
  notificationsEnabled: '@oryno_notifications_enabled',
  notificationsPromptDismissed: '@oryno_notifications_prompt_dismissed',
  seenNotificationIds: '@oryno_seen_notification_ids',
} as const;
