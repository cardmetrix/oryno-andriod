import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationListSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  useNotificationsQuery,
  type NotificationsResponse,
} from '@/hooks/use-notifications-query';
import { api } from '@/lib/api';
import { hrefToAppRoute, setAppBadge } from '@/lib/push-notifications';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';
import type { AppNotificationDto } from '@/lib/types';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const { items, unreadCount, loading, refresh } = useNotificationsQuery();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setRefreshing(false);
    }
  };

  const applyResponse = (json: NotificationsResponse) => {
    queryClient.setQueryData(queryKeys.notifications, json);
    void setAppBadge(json.unreadCount ?? 0);
  };

  const markOne = async (id: string) => {
    try {
      const json = await api.patch<NotificationsResponse & { ok: true }>('/api/notifications', {
        id,
      });
      applyResponse(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update notification');
    }
  };

  const openNotification = async (n: AppNotificationDto) => {
    if (n.unread) await markOne(n.id);
    const route = hrefToAppRoute(n.href);
    try {
      router.push(route as never);
    } catch {
      // stay on inbox
    }
  };

  const markAll = async () => {
    try {
      const json = await api.patch<NotificationsResponse & { ok: true }>('/api/notifications', {
        markAll: true,
      });
      applyResponse(json);
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not mark all as read');
    }
  };

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      {/* Android has no native grabber — show a soft handle. */}
      {Platform.OS === 'android' ? (
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
      ) : (
        <View style={styles.handleSpacer} />
      )}

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'Wallet & order updates'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => void markAll()}
              style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
              hitSlop={6}>
              <Text style={styles.markAll}>Mark all</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: colors.muted },
              pressed && { opacity: 0.75 },
            ]}
            accessibilityLabel="Close notifications"
            hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={Brand.orange}
          />
        }>
        {loading ? (
          <NotificationListSkeleton />
        ) : error && !items.length ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={28} color={Brand.error} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn’t load</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => void onRefresh()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={28} color={Brand.orange} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              You’re all caught up
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              New wallet and order updates will show here.
            </Text>
          </View>
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              style={[
                styles.row,
                {
                  borderColor: n.unread ? 'rgba(255,106,0,0.22)' : colors.border,
                  backgroundColor: n.unread ? 'rgba(255,106,0,0.04)' : colors.card,
                },
              ]}
              onPress={() => void openNotification(n)}>
              <View
                style={[
                  styles.dot,
                  !n.unread && { backgroundColor: colors.border },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{n.title}</Text>
                <Text
                  style={[styles.rowBody, { color: colors.mutedForeground }]}
                  numberOfLines={2}>
                  {n.body}
                </Text>
                <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>{n.time}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  handleSpacer: { height: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { marginTop: 2, fontSize: 13, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Brand.orangeMuted,
  },
  markAll: { color: Brand.orange, fontWeight: '700', fontSize: 12 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: Brand.orange,
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowBody: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  rowTime: { marginTop: 6, fontSize: 11, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 12,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retry: {
    marginTop: 8,
    backgroundColor: Brand.orange,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
});
