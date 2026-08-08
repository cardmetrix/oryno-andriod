import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import { Brand } from '@/constants/theme';

export type ServiceCategory =
  | 'Popular'
  | 'Telecom'
  | 'Lifestyle'
  | 'Utilities'
  | 'Coming soon';

export type ServiceDirectoryItem = {
  id: string;
  href: string;
  label: string;
  shortDescription: string;
  category: ServiceCategory;
  tags: string[];
  accent: string;
  popular?: boolean;
  soon?: boolean;
  renderIcon: (color: string, size?: number) => ReactNode;
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function ion(name: IoniconName) {
  return (color: string, size = 24) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export const servicesDirectory: ServiceDirectoryItem[] = [
  {
    id: 'airtime',
    href: '/(app)/services/airtime',
    label: 'Airtime',
    shortDescription: 'Top up any network instantly',
    category: 'Telecom',
    tags: ['MTN', 'Airtel', 'Glo', '9mobile'],
    accent: Brand.orange,
    popular: true,
    renderIcon: ion('phone-portrait-outline'),
  },
  {
    id: 'data',
    href: '/(app)/services/data',
    label: 'Data Bundles',
    shortDescription: 'Daily, weekly & monthly plans',
    category: 'Telecom',
    tags: ['MTN', 'Airtel', 'Glo', 'Smile'],
    accent: Brand.orangeSoft,
    popular: true,
    renderIcon: ion('wifi-outline'),
  },
  {
    id: 'bills',
    href: '/(app)/services/bills',
    label: 'Bill Payments',
    shortDescription: 'TV & electricity',
    category: 'Utilities',
    tags: ['DStv', 'GOtv', 'IKEDC', 'EKEDC'],
    accent: '#E85D00',
    popular: true,
    renderIcon: ion('flash-outline'),
  },
  {
    id: 'social',
    href: '/(app)/services/social',
    label: 'Social Boost',
    shortDescription: 'Followers, likes & views',
    category: 'Lifestyle',
    tags: ['Instagram', 'TikTok', 'YouTube'],
    accent: '#C44D00',
    popular: true,
    renderIcon: ion('trending-up-outline'),
  },
  {
    id: 'virtual-numbers',
    href: '/(app)/services/virtual-numbers',
    label: 'Virtual Numbers',
    shortDescription: 'Buy or rent SMS lines',
    category: 'Lifestyle',
    tags: ['Buy', 'Rent', 'SMS'],
    accent: '#9A3A00',
    renderIcon: ion('call-outline'),
  },
  {
    id: 'emails',
    href: '/(app)/services/emails',
    label: 'Rent Email',
    shortDescription: 'Temporary inboxes for OTP',
    category: 'Lifestyle',
    tags: ['Rent', 'OTP', 'Inbox'],
    accent: '#7A2E00',
    popular: true,
    renderIcon: ion('mail-outline'),
  },
  {
    id: 'gift-cards-live',
    href: '/(app)/services/gift-cards-live',
    label: 'Gift Card Live',
    shortDescription: 'Live buy & sell rates',
    category: 'Lifestyle',
    tags: ['Live', 'Rates', 'Trade'],
    accent: Brand.orange,
    popular: true,
    renderIcon: (color, size = 24) => (
      <GiftCardIcon size={size} color={color} strokeWidth={1.75} />
    ),
  },
  {
    id: 'gift-cards',
    href: '/(app)/services/gift-cards',
    label: 'Gift Cards',
    shortDescription: 'Buy & sell gift cards',
    category: 'Lifestyle',
    tags: ['Amazon', 'Apple', 'Steam'],
    accent: Brand.orange,
    renderIcon: (color, size = 24) => (
      <GiftCardIcon size={size} color={color} strokeWidth={1.75} />
    ),
  },
];

export const serviceCategories: Array<ServiceCategory | 'All'> = [
  'All',
  'Popular',
  'Telecom',
  'Lifestyle',
  'Utilities',
  'Coming soon',
];

export function filterServices(
  items: ServiceDirectoryItem[],
  opts: { query?: string; category?: string },
) {
  const q = (opts.query ?? '').trim().toLowerCase();
  const category = opts.category ?? 'All';

  return items.filter((item) => {
    const matchesCategory =
      category === 'All' ||
      (category === 'Popular' && item.popular) ||
      (category === 'Coming soon' && item.soon) ||
      item.category === category;

    const haystack = [item.label, item.shortDescription, item.category, ...item.tags]
      .join(' ')
      .toLowerCase();

    return (!q || haystack.includes(q)) && matchesCategory;
  });
}
