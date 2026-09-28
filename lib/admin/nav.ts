import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type AdminNavItem = {
  href: string;
  label: string;
  icon: IoniconName;
};

export const adminNav: AdminNavItem[] = [
  { href: '/(app)/admin', label: 'Overview', icon: 'grid-outline' },
  { href: '/(app)/admin/users', label: 'Users', icon: 'people-outline' },
  { href: '/(app)/admin/support', label: 'Support', icon: 'headset-outline' },
  {
    href: '/(app)/admin/waitlist',
    label: 'USD Card Waitlist',
    icon: 'card-outline',
  },
  {
    href: '/(app)/admin/gifting-waitlist',
    label: 'Gifting Waitlist',
    icon: 'gift-outline',
  },
  {
    href: '/(app)/admin/virtual-cards',
    label: 'Virtual Cards',
    icon: 'card-outline',
  },
  {
    href: '/(app)/admin/transaction-pins',
    label: 'Transaction PINs',
    icon: 'key-outline',
  },
  { href: '/(app)/admin/wallets', label: 'Wallets', icon: 'wallet-outline' },
  { href: '/(app)/admin/gift-cards', label: 'Gift Cards', icon: 'gift-outline' },
  { href: '/(app)/admin/invoices', label: 'Invoices', icon: 'document-text-outline' },
  {
    href: '/(app)/admin/virtual-numbers',
    label: 'Virtual Numbers',
    icon: 'call-outline',
  },
  { href: '/(app)/admin/providers', label: 'Providers', icon: 'wifi-outline' },
  { href: '/(app)/admin/pricing', label: 'Pricing', icon: 'pricetags-outline' },
  { href: '/(app)/admin/revenue', label: 'Revenue', icon: 'cash-outline' },
  { href: '/(app)/admin/bills', label: 'Bill Providers', icon: 'flash-outline' },
  {
    href: '/(app)/admin/betting',
    label: 'Betting Funding',
    icon: 'trophy-outline',
  },
  { href: '/(app)/admin/referrals', label: 'Referrals', icon: 'bar-chart-outline' },
  {
    href: '/(app)/admin/notifications',
    label: 'Email & Alerts',
    icon: 'notifications-outline',
  },
  { href: '/(app)/admin/ads', label: 'Ads', icon: 'images-outline' },
  {
    href: '/(app)/admin/landing',
    label: 'Landing images',
    icon: 'layers-outline',
  },
  {
    href: '/(app)/admin/testimonials',
    label: 'Testimonials',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    href: '/(app)/admin/onboarding',
    label: 'Onboarding',
    icon: 'phone-portrait-outline',
  },
  { href: '/(app)/admin/countries', label: 'Countries', icon: 'globe-outline' },
  { href: '/(app)/admin/gateways', label: 'Gateways', icon: 'card-outline' },
  { href: '/(app)/admin/reports', label: 'Reports', icon: 'stats-chart-outline' },
  { href: '/(app)/admin/settings', label: 'Settings', icon: 'settings-outline' },
];

export type AdminBottomTab = {
  href: string;
  /** Path fragments used for active matching (no group prefixes). */
  match: string;
  label: string;
  icon: IoniconName;
  iconFocused: IoniconName;
};

export const adminBottomTabs: AdminBottomTab[] = [
  {
    href: '/(app)/admin',
    match: '/admin',
    label: 'Overview',
    icon: 'grid-outline',
    iconFocused: 'grid',
  },
  {
    href: '/(app)/admin/users',
    match: '/admin/users',
    label: 'Users',
    icon: 'people-outline',
    iconFocused: 'people',
  },
  {
    href: '/(app)/admin/support',
    match: '/admin/support',
    label: 'Support',
    icon: 'headset-outline',
    iconFocused: 'headset',
  },
  {
    href: '/(app)/admin/wallets',
    match: '/admin/wallets',
    label: 'Wallets',
    icon: 'wallet-outline',
    iconFocused: 'wallet',
  },
  {
    href: '/(app)/admin/more',
    match: '/admin/more',
    label: 'More',
    icon: 'ellipsis-horizontal-outline',
    iconFocused: 'ellipsis-horizontal',
  },
];

export function isAdminNavActive(pathname: string, match: string) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (match === '/admin') {
    return path === '/admin' || path.endsWith('/admin');
  }
  return path === match || path.endsWith(match) || path.includes(`${match}/`);
}
