import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { NotificationListSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  useNotificationsQuery,
  type NotificationsResponse,
} from '@/hooks/use-notifications-query';
import { api } from '@/lib/api';
import { notificationVisual } from '@/lib/notification-visual';
import { hrefToAppRoute, setAppBadge } from '@/lib/push-notifications';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';
import type { AppNotificationDto } from '@/lib/types';

const filters = ['All', 'Unread', 'Wallet', 'System'] as const;
type Filter = (typeof filters)[number];

export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { items, unreadCount, loading, refresh } = useNotificationsQuery();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Unread' && item.unread) ||
        (filter === 'Wallet' && (item.type === 'fund' || item.type === 'withdraw')) ||
        (filter === 'System' &&
          (item.type === 'system' || item.type === 'security' || item.type === 'promo'));
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [items, filter, query]);

  const hasFilters = filter !== 'All' || Boolean(query.trim());
  const hasRead = items.some((i) => !i.unread);

  const markOne = async (id: string) => {
    setBusyId(id);
    try {
      const json = await api.patch<NotificationsResponse & { ok: true }>('/api/notifications', {
        id,
      });
      applyResponse(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update notification');
    } finally {
      setBusyId(null);
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

  const clearRead = async () => {
    try {
      const json = await api.delete<NotificationsResponse>('/api/notifications?clearRead=1');
      applyResponse(json);
      toast.success('Read notifications cleared');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not clear read notifications');
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
            unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
              : 'Alerts, wallet updates & promos'
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
              <Ionicons
                name="checkmark-done-outline"
                size={16}
                color={unreadCount === 0 ? colors.mutedForeground : Brand.orange}
              />
              <Text style={styles.markAll}>Mark all read</Text>
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
      ) : (
        <>
          <Animated.View entering={FadeIn.duration(180)} style={styles.toolbar}>
            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.mutedForeground}
                style={styles.searchIcon}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search notifications…"
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.filterRow}>
              {filters.map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setFilter(tab)}
                  style={[styles.filterChip, filter === tab && styles.filterChipActive]}>
                  <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
                    {tab}
                    {tab === 'Unread' && unreadCount > 0 ? ` · ${unreadCount}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            {hasRead ? (
              <Pressable onPress={() => void clearRead()} style={styles.clearRead}>
                <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                <Text style={styles.clearReadText}>Clear read</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          {visible.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={28} color={Brand.orange} />
              <Text style={styles.emptyTitle}>
                {hasFilters ? 'No matches' : 'You’re all caught up'}
              </Text>
              <Text style={styles.emptySub}>
                {hasFilters
                  ? 'Try another filter or search term.'
                  : 'New wallet and order updates will show here.'}
              </Text>
              {hasFilters ? (
                <Pressable
                  style={styles.retry}
                  onPress={() => {
                    setFilter('All');
                    setQuery('');
                  }}>
                  <Text style={styles.retryText}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            visible.map((n, index) => {
              const visual = notificationVisual(n.type);
              return (
                <Animated.View
                  key={n.id}
                  entering={FadeInDown.delay(Math.min(index * 30, 240)).duration(180)}>
                  <View
                    style={[
                      styles.card,
                      n.unread && styles.cardUnread,
                      busyId === n.id && { opacity: 0.6 },
                    ]}>
                    <Pressable
                      style={styles.cardMain}
                      onPressIn={(event) => {
                        pressY.current = event.nativeEvent.pageY;
                      }}
                      onPress={(event) => openNotification(n, event.nativeEvent.pageY)}>
                      <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
                        <Ionicons name={visual.icon} size={20} color={visual.fg} />
                      </View>
                      <View style={styles.rowCopy}>
                        <View style={styles.rowTop}>
                          <Text
                            style={[styles.rowTitle, !n.unread && styles.rowTitleRead]}
                            numberOfLines={1}>
                            {n.title}
                          </Text>
                          {n.unread ? <View style={styles.unreadDot} /> : null}
                        </View>
                        <Text style={styles.rowBody} numberOfLines={2}>
                          {n.body}
                        </Text>
                        <View style={styles.metaRow}>
                          <Text style={styles.rowTime}>{n.time}</Text>
                          <View style={styles.typePill}>
                            <Text style={styles.typePillText}>{n.type}</Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                    {n.unread ? (
                      <Pressable
                        onPress={() => void markOne(n.id)}
                        style={styles.readBtn}
                        hitSlop={6}>
                        <Text style={styles.readBtnText}>Read</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Animated.View>
              );
            })
          )}
        </>
      )}
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    markAll: { color: Brand.orange, fontWeight: '700', fontSize: 12 },
    markAllDisabled: { opacity: 0.4 },
    toolbar: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      marginBottom: 12,
    },
    searchWrap: { position: 'relative' },
    searchIcon: { position: 'absolute', left: 12, top: 13, zIndex: 1 },
    searchInput: {
      height: 44,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingLeft: 40,
      paddingRight: 12,
      fontSize: 14,
      color: colors.foreground,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    filterChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.muted,
    },
    filterChipActive: { backgroundColor: colors.foreground },
    filterText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    filterTextActive: { color: colors.background },
    clearRead: {
      marginTop: 10,
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    clearReadText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
      marginBottom: 10,
    },
    cardUnread: { backgroundColor: Brand.orangeMuted },
    cardMain: { flex: 1, flexDirection: 'row', gap: 10 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: { flex: 1, minWidth: 0, gap: 3 },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Brand.orange,
    },
    rowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.foreground },
    rowTitleRead: { fontWeight: '500' },
    rowBody: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    rowTime: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground },
    typePill: {
      borderRadius: 999,
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    typePillText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'capitalize',
    },
    readBtn: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.background,
    },
    readBtnText: { fontSize: 10, fontWeight: '800', color: Brand.orange },
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
