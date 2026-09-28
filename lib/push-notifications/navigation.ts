import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { logNotificationContent, pushDebug } from './debug';

/** Map website hrefs (e.g. /wallet) to Expo Router paths. */
export function hrefToAppRoute(href?: string | null): string {
  if (!href) return '/(app)/notifications';
  const path = href.startsWith('/') ? href : `/${href}`;
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';

  const map: Record<string, string> = {
    '/': '/(app)/(tabs)',
    '/dashboard': '/(app)/(tabs)',
    '/home': '/(app)/(tabs)',
    '/wallet': '/(app)/(tabs)/cards',
    '/cards': '/(app)/(tabs)/cards',
    '/history': '/(app)/(tabs)/history',
    '/services': '/(app)/(tabs)/services',
    '/profile': '/(app)/(tabs)/profile',
    '/notifications': '/(app)/notifications',
    '/referrals': '/(app)/referrals',
    '/settings': '/(app)/settings',
    '/settings/security': '/(app)/settings/security',
    '/support': '/(app)/support',
    '/fund': '/(app)/fund',
    '/withdraw': '/(app)/withdraw',
    '/services/airtime': '/(app)/services/airtime',
    '/services/data': '/(app)/services/data',
    '/services/bills': '/(app)/services/bills',
    '/services/social': '/(app)/services/social',
    '/services/gift-cards': '/(app)/services/gift-cards',
    '/services/gift-cards-live': '/(app)/services/gift-cards-live',
    '/services/virtual-numbers': '/(app)/services/virtual-numbers',
    '/services/emails': '/(app)/services/emails',
    '/login': '/(auth)/login',
  };

  if (map[normalized]) return map[normalized];
  if (normalized.startsWith('/history/')) {
    return `/(app)/history/${normalized.slice('/history/'.length)}`;
  }
  if (normalized.startsWith('/admin')) return '/(app)/notifications';
  if (normalized.startsWith('/services/')) return `/(app)${normalized}`;
  if (normalized.startsWith('/settings/')) return `/(app)${normalized}`;
  return '/(app)/notifications';
}

export function getNotificationHref(
  data: Record<string, unknown> | undefined | null,
): string | null {
  if (!data) return null;
  const href = data.href;
  return typeof href === 'string' ? href : null;
}

export function navigateFromNotificationData(
  data: Record<string, unknown> | undefined,
): void {
  pushDebug('info', 'navigation', 'Handling notification tap', data);
  const href = getNotificationHref(data);
  const route = hrefToAppRoute(href);
  try {
    router.push(route as never);
  } catch {
    router.push('/(app)/notifications');
  }
}

export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  logNotificationContent('tap', response.notification);
  navigateFromNotificationData(
    response.notification.request.content.data as Record<string, unknown>,
  );
}

export async function handleInitialNotificationResponse(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) handleNotificationResponse(response);
}
