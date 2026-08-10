import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { api } from '@/lib/api';
import {
  mirrorInAppNotification,
  NOTIFICATION_POLL_MS,
  setAppBadge,
  STORAGE_KEYS,
} from '@/lib/push-notifications';
import type { AppNotificationDto } from '@/lib/types';

const MAX_TRACKED = 200;

type NotificationsResponse = {
  items: AppNotificationDto[];
  unreadCount: number;
};

async function loadSeenIds(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveSeenIds(key: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-MAX_TRACKED)));
}

/**
 * Fallback bridge: poll inbox and mirror newly unread items as local banners
 * when remote Expo push is unavailable (no registered device token).
 * Disabled while the device is registered — otherwise users get duplicate alerts.
 */
export function useNotificationPushBridge(enabled = true): void {
  const seenRef = useRef<Set<string> | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const json = await api.get<NotificationsResponse>('/api/notifications');
        if (cancelled) return;

        void setAppBadge(json.unreadCount ?? 0);

        if (!hydratedRef.current) {
          seenRef.current = await loadSeenIds(STORAGE_KEYS.seenNotificationIds);
          // Seed with current items so we don't spam banners for old history.
          for (const item of json.items ?? []) {
            seenRef.current.add(item.id);
          }
          hydratedRef.current = true;
          await saveSeenIds(STORAGE_KEYS.seenNotificationIds, seenRef.current);
          return;
        }

        const seen = seenRef.current ?? new Set<string>();
        const fresh = (json.items ?? []).filter((n) => !seen.has(n.id));
        if (fresh.length === 0) return;

        for (const item of fresh) {
          if (item.unread) {
            await mirrorInAppNotification({
              id: item.id,
              title: item.title,
              body: item.body,
              href: item.href,
              type: item.type,
            });
          }
          seen.add(item.id);
        }

        seenRef.current = seen;
        await saveSeenIds(STORAGE_KEYS.seenNotificationIds, seen);
      } catch {
        // ignore transient poll errors
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, NOTIFICATION_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);
}
