import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export type AdSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string;
  badge?: string | null;
  overlayColors: string[];
};

const DEFAULT_COLORS = [
  'rgba(28,28,30,0.88)',
  'rgba(28,28,30,0.35)',
  'transparent',
] as const;

export async function fetchHomeAds() {
  const json = await api.get<{
    ads?: Array<{
      id: string;
      title: string;
      subtitle: string | null;
      href: string;
      imageUrl: string;
      badge?: string | null;
      overlayColors?: string[];
    }>;
  }>(`${endpoints.ads}?placement=home_carousel`);

  return (json.ads ?? []).map(
    (ad): AdSlide => ({
      id: ad.id,
      title: ad.title,
      subtitle: ad.subtitle,
      href: ad.href,
      imageUrl: ad.imageUrl,
      badge: ad.badge,
      overlayColors: ad.overlayColors?.length ? ad.overlayColors : [...DEFAULT_COLORS],
    }),
  );
}

export function useHomeAds() {
  const { isLoaded, isSignedIn } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.ads('home_carousel'),
    queryFn: fetchHomeAds,
    enabled: isLoaded && Boolean(isSignedIn),
    staleTime: STALE.ads,
  });

  useEffect(() => {
    const urls = (query.data ?? [])
      .map((ad) => ad.imageUrl)
      .filter((url) => Boolean(url));
    for (const url of urls) {
      void Image.prefetch(url);
    }
  }, [query.data]);

  return {
    ads: query.data ?? [],
    loaded: !query.isLoading || Boolean(query.data),
    isFetching: query.isFetching,
    refresh: () => query.refetch(),
  };
}
