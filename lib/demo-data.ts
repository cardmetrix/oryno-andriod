import { formatNaira } from '@/lib/format';

export type DemoUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  currencySymbol: string;
  kycStatus: 'unverified' | 'pending' | 'verified';
};

export type DemoTransaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'credit' | 'debit';
  status: 'success' | 'pending' | 'failed';
  category: string;
  createdAt: string;
};

export const demoUser: DemoUser = {
  id: 'usr_demo_1',
  fullName: 'Chidi Okechukwu',
  email: 'chidi@oryno.com',
  phone: '+234 801 234 5678',
  country: 'Nigeria',
  currency: 'NGN',
  currencySymbol: '₦',
  kycStatus: 'pending',
};

export const demoWallet = {
  balance: 28450,
  balanceFormatted: formatNaira(28450),
  usdBalance: 42.5,
  usdBalanceFormatted: '$42.50',
  cardNumber: '•••• 4821',
};

export const demoTransactions: DemoTransaction[] = [
  {
    id: 'tx_1',
    title: 'MTN Airtime',
    subtitle: '0803 *** 4521',
    amount: 1000,
    type: 'debit',
    status: 'success',
    category: 'airtime',
    createdAt: 'Today · 09:14',
  },
  {
    id: 'tx_2',
    title: 'Wallet Fund',
    subtitle: 'Paystack · Bank transfer',
    amount: 15000,
    type: 'credit',
    status: 'success',
    category: 'fund',
    createdAt: 'Yesterday · 18:02',
  },
  {
    id: 'tx_3',
    title: 'Instagram Boost',
    subtitle: '1,000 Followers',
    amount: 2500,
    type: 'debit',
    status: 'pending',
    category: 'social',
    createdAt: 'Yesterday · 14:40',
  },
  {
    id: 'tx_4',
    title: 'Amazon Gift Card Sell',
    subtitle: '$50 · Sogo',
    amount: 72000,
    type: 'credit',
    status: 'success',
    category: 'gift_card',
    createdAt: 'Mon · 11:20',
  },
  {
    id: 'tx_5',
    title: 'DStv Compact',
    subtitle: 'Smartcard · 7031****',
    amount: 10500,
    type: 'debit',
    status: 'success',
    category: 'bill',
    createdAt: 'Sun · 08:55',
  },
];

export const demoNotifications = [
  {
    id: 'n1',
    title: 'Wallet credited',
    body: '₦15,000 was added to your wallet via Paystack.',
    time: '2h ago',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Boost order processing',
    body: 'Your Instagram 1,000 followers order is being delivered.',
    time: '5h ago',
    unread: true,
  },
  {
    id: 'n3',
    title: 'KYC reminder',
    body: 'Complete verification to unlock higher withdrawal limits.',
    time: '1d ago',
    unread: false,
  },
];

export const demoBanks = [
  { id: 'gtb', name: 'Guaranty Trust Bank', code: '058' },
  { id: 'access', name: 'Access Bank', code: '044' },
  { id: 'uba', name: 'United Bank for Africa', code: '033' },
  { id: 'zenith', name: 'Zenith Bank', code: '057' },
];
