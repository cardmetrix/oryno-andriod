import type { ReactNode } from 'react';

import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import {
  ActivityIcon,
  FileTextIcon,
  GiftServiceIcon,
  Link2Icon,
  PhoneIcon,
  SmartphoneIcon,
  TrendingUpIcon,
  TrophyIcon,
  TvIcon,
  WifiIcon,
  ZapIcon,
} from '@/components/icons/lucide-service-icons';
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
  /** Highlight filter: "Most popular" | "Hot" | "Free" */
  stats?: string;
  renderIcon: (color: string, size?: number) => ReactNode;
};

function glyph(
  Icon: (props: { size?: number; color?: string; strokeWidth?: number }) => ReactNode,
) {
  return (color: string, size = 24) => <Icon size={size} color={color} strokeWidth={1.75} />;
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
    renderIcon: glyph(SmartphoneIcon),
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
    renderIcon: glyph(WifiIcon),
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
    renderIcon: glyph(ZapIcon),
  },
  {
    id: 'bills',
    href: '/(app)/services/tv',
    label: 'TV Bills',
    shortDescription: 'DStv, GOtv, StarTimes & water utilities',
    category: 'Utilities',
    tags: ['DStv', 'GOtv', 'StarTimes'],
    accent: Brand.orange,
    popular: true,
    renderIcon: glyph(TvIcon),
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
    renderIcon: glyph(TrophyIcon),
  },
  {
    id: 'social',
    href: '/(app)/services/social',
    label: 'Social Boost',
    shortDescription: 'Followers, likes & views',
    category: 'Lifestyle',
    tags: ['Instagram', 'TikTok', 'YouTube', 'Most popular'],
    accent: Brand.orange,
    popular: true,
    stats: 'Most popular',
    renderIcon: glyph(TrendingUpIcon),
  },
  {
    id: 'virtual-numbers',
    href: '/(app)/services/virtual-numbers',
    label: 'Virtual Numbers',
    shortDescription: 'Get verification numbers worldwide',
    category: 'Lifestyle',
    tags: ['Buy', 'Rent', 'SMS', 'Hot'],
    accent: Brand.orange,
    stats: 'Hot',
    renderIcon: glyph(PhoneIcon),
  },
  {
    id: 'gift-cards-live',
    href: '/(app)/services/gift-cards-live',
    label: 'Gift Card Live',
    shortDescription: 'Browse cards to buy with USD',
    category: 'Lifestyle',
    tags: ['Live', 'Buy', 'USD'],
    accent: Brand.orange,
    popular: true,
    stats: 'Live board',
    renderIcon: glyph(ActivityIcon),
  },
  {
    id: 'gift-cards',
    href: '/(app)/services/gift-cards',
    label: 'Buy Gift Cards',
    shortDescription: 'Buy gift cards with USD',
    category: 'Lifestyle',
    tags: ['Amazon', 'Apple', 'Steam'],
    accent: Brand.orange,
    renderIcon: glyph(GiftCardIcon),
  },
  {
    id: 'international-gifting',
    href: '/(app)/services/international-gifting',
    label: 'International Gifting',
    shortDescription: 'Send gifts worldwide - coming soon',
    category: 'Coming soon',
    tags: ['Gifting', 'International', 'Waitlist', 'USD'],
    accent: Brand.orange,
    soon: true,
    popular: true,
    stats: 'Waitlist open',
    renderIcon: glyph(GiftServiceIcon),
  },
  {
    id: 'invoices',
    href: '/(app)/invoices',
    label: 'Invoice Generator',
    shortDescription: 'Free professional invoices + PDF',
    category: 'Lifestyle',
    tags: ['Free', 'PDF', 'Invoice'],
    accent: Brand.orange,
    popular: true,
    stats: 'Free',
    renderIcon: glyph(FileTextIcon),
  },
  {
    id: 'payment-links',
    href: '/(app)/payment-links',
    label: 'Payment Links',
    shortDescription: 'Get paid without an invoice',
    category: 'Lifestyle',
    tags: ['Checkout', 'Flutterwave', 'Pay'],
    accent: Brand.orange,
    popular: true,
    stats: 'Standalone checkout',
    renderIcon: glyph(Link2Icon),
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

    if (item.id === 'gift-cards') {
      return {
        ...item,
        shortDescription: 'Buy digital gift cards with USD',
        stats: '50+ brands',
      };
    }

    return item;
  });
}

export const serviceCategories = [
  'All',
  'Popular',
  'Most popular',
  'Hot',
  'Free',
  'Telecom',
  'Lifestyle',
  'Utilities',
  'Coming soon',
] as const;

export type ServiceFilterCategory = (typeof serviceCategories)[number];

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
      (category === 'Most popular' &&
        ((item.stats ?? '').toLowerCase() === 'most popular' ||
          item.tags.some((t) => t.toLowerCase() === 'most popular'))) ||
      (category === 'Hot' &&
        ((item.stats ?? '').toLowerCase() === 'hot' ||
          item.tags.some((t) => t.toLowerCase() === 'hot'))) ||
      (category === 'Free' &&
        ((item.stats ?? '').toLowerCase() === 'free' ||
          item.tags.some((t) => t.toLowerCase() === 'free'))) ||
      (category === 'Coming soon' &&
        (item.soon || item.category === 'Coming soon')) ||
      item.category === category;

    const haystack = [
      item.label,
      item.shortDescription,
      item.category,
      item.stats ?? '',
      ...item.tags,
    ]
      .join(' ')
      .toLowerCase();

    return (!q || haystack.includes(q)) && matchesCategory;
  });
}
