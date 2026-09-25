import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { NotificationListSkeleton } from '@/components/ui/skeletons';
import { Brand, type ThemeColors } from '@/constants/theme';
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { items, unreadCount, loading, refresh } = useNotificationsQuery();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openingRef = useRef<string | null>(null);
  const pressY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      openingRef.current = null;
    }, []),
  );

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

  const openNotification = (n: AppNotificationDto, releaseY: number) => {
    if (refreshing) return;
    if (Math.abs(releaseY - pressY.current) > 12) return;
    if (openingRef.current) return;
    openingRef.current = n.id;
    if (n.unread) void markOne(n.id);
    const route = hrefToAppRoute(n.href);
    try {
      router.push(route as never);
    } catch {
      openingRef.current = null;
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
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      header={
        <PageHeader
          title="Notifications"
          subtitle={
            unreadCount > 0 ? `${unreadCount} unread` : 'Wallet & order updates'
          }
          showBack
          right={
            <Pressable
              onPress={() => void markAll()}
              disabled={unreadCount === 0}
              style={({ pressed }) => [
                styles.markAllBtn,
                unreadCount === 0 && styles.markAllDisabled,
                pressed && unreadCount > 0 && { opacity: 0.7 },
              ]}
              hitSlop={6}>
              <Text style={styles.markAll}>Mark all</Text>
            </Pressable>
          }
        />
      }>
      {loading ? (
        <NotificationListSkeleton />
      ) : error && !items.length ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={28} color={Brand.error} />
          <Text style={styles.emptyTitle}>Couldn’t load</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void onRefresh()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={28} color={Brand.orange} />
          <Text style={styles.emptyTitle}>You’re all caught up</Text>
          <Text style={styles.emptySub}>
            New wallet and order updates will show here.
          </Text>
        </View>
      ) : (
        items.map((n, index) => (
          <Pressable
            key={n.id}
            style={({ pressed }) => [
              styles.row,
              index === items.length - 1 && styles.rowLast,
              pressed && { opacity: 0.65 },
            ]}
            onPressIn={(event) => {
              pressY.current = event.nativeEvent.pageY;
            }}
            onPress={(event) => openNotification(n, event.nativeEvent.pageY)}>
            <View style={[styles.dot, !n.unread && styles.dotRead]} />
            <View style={styles.rowCopy}>
              <View style={styles.rowTop}>
                <Text
                  style={[styles.rowTitle, !n.unread && styles.rowTitleRead]}
                  numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={styles.rowTime}>{n.time}</Text>
              </View>
              <Text style={styles.rowBody} numberOfLines={2}>
                {n.body}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    markAllBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
       
    },
    markAll: { color: Brand.orange, fontWeight: '700', fontSize: 12 },
    markAllDisabled: { opacity: 0.4 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowCopy: { flex: 1, minWidth: 0, gap: 3 },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
      backgroundColor: Brand.orange,
    },
    dotRead: { backgroundColor: 'transparent' },
    rowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.foreground },
    rowTitleRead: { fontWeight: '500' },
    rowBody: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
    rowTime: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 12,
      gap: 8,
    },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    emptySub: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      color: colors.mutedForeground,
    },
    retry: {
      marginTop: 8,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
  });
}
