import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import { Brand } from '@/constants/theme';
import { getCountryInfo, type SupportedCountryCode } from '@/lib/country';

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

const BETTING_COPY: Record<
  SupportedCountryCode,
  { short: string; tags: string[] }
> = {
  NG: {
    short: 'Fund SportyBet, Bet9ja & more',
    tags: ['Bet9ja', 'SportyBet', '1xBet', 'BetKing', 'MelBet'],
  },
  GH: {
    short: 'Fund SportyBet, Betway & more',
    tags: ['SportyBet', 'Betway', 'Premier Bet', '1xBet', 'MelBet'],
  },
  KE: {
    short: 'Fund SportPesa, Betika & more',
    tags: ['SportPesa', 'Betika', 'Odibets', 'Betway', '1xBet'],
  },
  ZA: {
    short: 'Fund Betway, Hollywoodbets & more',
    tags: ['Betway', 'Hollywoodbets', 'SuperSportBet', 'Easybet'],
  },
};

export const servicesDirectory: ServiceDirectoryItem[] = [
  {
    id: 'airtime',
    href: '/(app)/services/airtime',
    label: 'Airtime',
    shortDescription: 'Top up any network instantly',
    category: 'Telecom',
    tags: ['MTN', 'Airtel', 'Glo', '9mobile', 'International'],
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
    tags: ['MTN', 'Airtel', 'Glo', 'Smile', 'SME'],
    accent: Brand.orange,
    popular: true,
    renderIcon: ion('wifi-outline'),
  },
  {
    id: 'electricity',
    href: '/(app)/services/electricity',
    label: 'Electricity',
    shortDescription: 'Prepaid & postpaid discos',
    category: 'Utilities',
    tags: ['IKEDC', 'EKEDC', 'AEDC', 'Prepaid'],
    accent: Brand.orange,
    popular: true,
    renderIcon: ion('flash-outline'),
  },
  {
    id: 'bills',
    href: '/(app)/services/tv',
    label: 'TV Bills',
    shortDescription: 'DStv, GOtv & StarTimes',
    category: 'Utilities',
    tags: ['DStv', 'GOtv', 'StarTimes'],
    accent: Brand.orange,
    popular: true,
    renderIcon: ion('tv-outline'),
  },
  {
    id: 'betting',
    href: '/(app)/services/betting',
    label: 'Betting',
    shortDescription: 'Fund SportyBet, Bet9ja & more',
    category: 'Utilities',
    tags: ['Bet9ja', 'SportyBet', '1xBet', 'BetKing', 'MelBet'],
    accent: Brand.orange,
    popular: true,
    renderIcon: ion('trophy-outline'),
  },
  {
    id: 'social',
    href: '/(app)/services/social',
    label: 'Social Boost',
    shortDescription: 'Followers, likes & views',
    category: 'Lifestyle',
    tags: ['Instagram', 'TikTok', 'YouTube'],
    accent: Brand.orange,
    popular: true,
    renderIcon: ion('trending-up-outline'),
  },
  {
    id: 'virtual-numbers',
    href: '/(app)/services/virtual-numbers',
    label: 'Virtual Numbers',
    shortDescription: 'Get verification numbers worldwide',
    category: 'Lifestyle',
    tags: ['Buy', 'Rent', 'SMS'],
    accent: Brand.orange,
    renderIcon: ion('call-outline'),
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
    renderIcon: ion('pulse-outline'),
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

export function getServicesDirectory(countryCode?: string | null) {
  const country = getCountryInfo(countryCode);
  const betting = BETTING_COPY[country.code];

  return servicesDirectory.map((item) => {
    if (item.id === 'airtime') {
      if (country.code === 'ZA') {
        return {
          ...item,
          shortDescription: 'MTN, Vodacom, Cell C & Telkom',
          tags: ['MTN', 'Vodacom', 'Cell C', 'Telkom'],
        };
      }
      return item;
    }

    if (item.id === 'data' && country.code === 'ZA') {
      return {
        ...item,
        shortDescription: 'MTN, Vodacom, Cell C & Telkom',
        tags: ['MTN', 'Vodacom', 'Cell C', 'Telkom'],
      };
    }
    if (item.id === 'data' && country.code === 'KE') {
      return {
        ...item,
        shortDescription: 'Safaricom, Airtel & Telkom Kenya',
        tags: ['Safaricom', 'Airtel', 'Telkom'],
      };
    }
    if (item.id === 'data' && country.code === 'GH') {
      return {
        ...item,
        shortDescription: 'MTN, Telecel & AirtelTigo',
        tags: ['MTN', 'Telecel', 'AirtelTigo'],
      };
    }

    if (item.id === 'betting') {
      return {
        ...item,
        shortDescription: betting.short,
        tags: betting.tags,
      };
    }

    if (item.id === 'bills') {
      if (country.code === 'GH') {
        return {
          ...item,
          shortDescription: 'DStv, GOtv & Ghana Water',
          tags: ['DStv', 'GOtv', 'Ghana Water'],
        };
      }
      if (country.code === 'KE') {
        return {
          ...item,
          shortDescription: 'DStv, GOtv & Nairobi Water',
          tags: ['DStv', 'GOtv', 'Nairobi Water', 'Zuku'],
        };
      }
      if (country.code === 'ZA') {
        return {
          ...item,
          shortDescription: 'DStv, GOtv & Johannesburg Water',
          tags: ['DStv', 'GOtv', 'Johannesburg Water'],
        };
      }
    }

    if (item.id === 'electricity') {
      if (country.code === 'GH') {
        return {
          ...item,
          shortDescription: 'ECG prepaid & postpaid',
          tags: ['ECG', 'Prepaid', 'Postpaid'],
        };
      }
      if (country.code === 'KE') {
        return {
          ...item,
          shortDescription: 'Kenya Power (KPLC)',
          tags: ['KPLC', 'Prepaid', 'Postpaid'],
        };
      }
      if (country.code === 'ZA') {
        return {
          ...item,
          shortDescription: 'Eskom & City Power',
          tags: ['Eskom', 'City Power'],
        };
      }
    }

    return item;
  });
}

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
