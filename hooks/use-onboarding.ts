import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export type OnboardingSlide = {
  id: string;
  title: string;
  subtitle: string;
  /** Remote URL or local require() asset. */
  image: ImageSourcePropType;
  imageUrl?: string;
  accent: string;
  sortOrder: number;
};

const DEFAULT_ACCENT = '#FF6A00';

/** Offline / first-paint fallback matching the seeded admin slides. */
export const LOCAL_ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'local-wallet',
    title: 'Your borderless wallet',
    subtitle:
      'Fund, convert, and spend across Africa with live multi-currency balances.',
    image: require('@/assets/onboarding/wallet.png'),
    accent: '#FF6A00',
    sortOrder: 0,
  },
  {
    id: 'local-gift',
    title: 'Buy & sell gift cards',
    subtitle:
      'Trade Amazon, Apple, Steam, and more with live rates credited to your wallet.',
    image: require('@/assets/onboarding/gift-cards.png'),
    accent: '#FF8C42',
    sortOrder: 1,
  },
  {
    id: 'local-data',
    title: 'Airtime & data',
    subtitle:
      'Top up MTN, Airtel, Glo, 9mobile and buy data bundles in seconds.',
    image: require('@/assets/onboarding/data.png'),
    accent: '#FF6A00',
    sortOrder: 2,
  },
  {
    id: 'local-bills',
    title: 'Pay bills instantly',
    subtitle: 'Electricity, DStv, GOtv, Startimes — all from one secure app.',
    image: require('@/assets/onboarding/bills.png'),
    accent: '#E85D00',
    sortOrder: 3,
  },
  {
    id: 'local-numbers',
    title: 'Numbers, emails & boost',
    subtitle:
      'Virtual numbers, temp emails, and social media boosting — ready when you are.',
    image: require('@/assets/onboarding/virtual-numbers.png'),
    accent: '#FF8124',
    sortOrder: 4,
  },
];

export async function fetchOnboardingSlides(): Promise<OnboardingSlide[]> {
  const json = await api.get<{
    slides?: Array<{
      id: string;
      title: string;
      subtitle: string;
      imageUrl: string;
      accent?: string | null;
      sortOrder?: number;
    }>;
  }>(endpoints.onboarding, { auth: false });

  const slides = (json.slides ?? [])
    .map(
      (slide, index): OnboardingSlide => ({
        id: slide.id,
        title: slide.title,
        subtitle: slide.subtitle,
        image: { uri: slide.imageUrl },
        imageUrl: slide.imageUrl,
        accent: slide.accent?.trim() || DEFAULT_ACCENT,
        sortOrder: slide.sortOrder ?? index,
      }),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!slides.length) {
    throw new Error('No onboarding slides');
  }

  return slides;
}

export function useOnboardingSlides() {
  const query = useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: fetchOnboardingSlides,
    staleTime: STALE.onboarding,
    placeholderData: LOCAL_ONBOARDING_SLIDES,
  });

  useEffect(() => {
    for (const slide of query.data ?? []) {
      if (slide.imageUrl) {
        void Image.prefetch(slide.imageUrl).catch(() => null);
      }
    }
  }, [query.data]);

  return {
    slides: query.data?.length ? query.data : LOCAL_ONBOARDING_SLIDES,
    loading: query.isLoading && !query.data,
    refreshing: query.isFetching && Boolean(query.data),
    error: query.error,
    refetch: query.refetch,
  };
}
