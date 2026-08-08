import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import type { ProfileDto } from '@/lib/types';

export type ProfileResponse = { profile: ProfileDto };

export async function fetchProfile() {
  return api.get<ProfileResponse>(endpoints.profile);
}

export function useProfile() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.profile,
    queryFn: fetchProfile,
    enabled: isLoaded && Boolean(isSignedIn),
    staleTime: STALE.profile,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      queryClient.removeQueries({ queryKey: queryKeys.profile });
    }
  }, [isLoaded, isSignedIn, queryClient]);

  const profile = query.data?.profile ?? null;
  const loading = query.isLoading && !profile;

  return {
    profile,
    data: query.data ?? null,
    loading,
    isFetching: query.isFetching,
    error:
      query.error instanceof Error
        ? query.error.message
        : query.isError
          ? 'Failed to load profile'
          : null,
    countryCode: profile?.countryCode || 'NG',
    countryName: profile?.countryName || 'Nigeria',
    refresh: () => query.refetch(),
  };
}
