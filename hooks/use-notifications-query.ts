import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { setAppBadge } from '@/lib/push-notifications';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import type { AppNotificationDto } from '@/lib/types';

export type NotificationsResponse = {
  items?: AppNotificationDto[];
  unreadCount?: number;
};

export async function fetchNotifications() {
  return api.get<NotificationsResponse>(endpoints.notifications);
}

export function useNotificationsQuery() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
    enabled: isLoaded && Boolean(isSignedIn),
    staleTime: STALE.notifications,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      queryClient.removeQueries({ queryKey: queryKeys.notifications });
      return;
    }
    if (typeof query.data?.unreadCount === 'number') {
      void setAppBadge(query.data.unreadCount);
    }
  }, [isLoaded, isSignedIn, query.data?.unreadCount, queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  /** Soft revalidate only when data is missing or past staleTime. */
  const refreshIfStale = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: queryKeys.notifications,
      type: 'active',
      stale: true,
    });
  }, [queryClient]);

  return {
    items: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    loading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    refresh,
    refreshIfStale,
  };
}
