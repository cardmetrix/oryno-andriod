export type CountryInfo = {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji?: string;
  locale?: string;
};

export type WalletSummary = {
  id: string;
  currency: string;
  balance: string;
  balanceFormatted: string;
  status: string;
  isPrimary: boolean;
  dailyLimit: string | null;
  cardNumber: string;
  cardNumberMasked: string;
};

export type BankAccountSummary = {
  id: string;
  bankName: string;
  bankCode?: string | null;
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
  verified: boolean;
  maskedNumber: string;
};

export type BankOption = {
  name: string;
  code: string;
};

export type AppTransaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  type: 'credit' | 'debit';
  status: string;
  category?: string;
  currency?: string;
  createdAt: string;
};

export type WalletPayload = {
  primary: WalletSummary;
  usd: WalletSummary | null;
  wallets: WalletSummary[];
  banks: BankAccountSummary[];
  recent: AppTransaction[];
  fx: {
    base: string;
    quote: string;
    midRate: number;
    buyRate: number;
    sellRate: number;
    commissionPercent?: number;
    provider?: string;
    asOf?: string;
  } | null;
  totals: {
    balance: string;
    balanceFormatted: string;
    currency: string;
    usdBalance: string;
    usdBalanceFormatted: string;
    bankCount: number;
    txCount: number;
  };
  user: { fullName: string; countryCode: string };
  country: CountryInfo;
};

export type ProfileDto = {
  id: string;
  clerkId: string | null;
  username: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  countryName: string;
  kycStatus: string;
  kycLevel: number;
  kycLabel: string;
  accountLevelName?: string;
  status: string;
  dailyLimitLabel: string;
  emailVerified: boolean;
  initials: string;
};

export type AppNotificationDto = {
  id: string;
  title: string;
  body: string;
  type: string;
  unread: boolean;
  time: string;
  createdAt: string;
  href?: string | null;
};

export type DepositAccount = {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankSlug: string | null;
  currency: string;
  provider: string;
  status: string;
  demoMode: boolean;
  instructions: string;
};

export type SyncResponse = {
  ok: true;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    countryCode: string;
    status: string;
    kycStatus: string;
  };
  country: CountryInfo;
  wallet: { id: string; currency: string; balance: string };
};
