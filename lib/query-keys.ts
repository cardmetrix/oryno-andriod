/** Central query keys — keep GET caches consistent and invalidate safely. */
export const queryKeys = {
  wallet: ['wallet'] as const,
  profile: ['profile'] as const,
  transactions: ['transactions'] as const,
  notifications: ['notifications'] as const,
  ads: (placement: string) => ['ads', placement] as const,
  onboarding: ['onboarding'] as const,
  catalogs: {
    vtpass: (identifier: string) => ['catalog', 'vtpass', identifier] as const,
    variations: (serviceId: string) => ['catalog', 'variations', serviceId] as const,
    internationalProductTypes: (code: string) =>
      ['catalog', 'intl-product-types', code] as const,
    internationalOperators: (code: string, productTypeId: number | string) =>
      ['catalog', 'intl-operators', code, String(productTypeId)] as const,
    social: ['catalog', 'social'] as const,
    giftCardSell: ['catalog', 'gift-card-sell'] as const,
    giftCardSellRates: ['catalog', 'gift-card-sell-rates'] as const,
    giftCardCountries: ['catalog', 'gift-card-countries'] as const,
    giftCardProducts: (countryCode: string) =>
      ['catalog', 'gift-card-products', countryCode] as const,
    numbersCountries: ['catalog', 'numbers-countries'] as const,
    numbersServices: ['catalog', 'numbers-services'] as const,
    numbersPrices: (params: string) => ['catalog', 'numbers-prices', params] as const,
    emailDomains: ['catalog', 'email-domains'] as const,
    betting: ['catalog', 'betting'] as const,
  },
  depositAccount: ['wallet', 'deposit-account'] as const,
} as const;

/** Root keys that are safe to persist to AsyncStorage. */
export const PERSISTABLE_QUERY_ROOTS = new Set([
  'wallet',
  'profile',
  'transactions',
  'notifications',
  'ads',
  'onboarding',
  'catalog',
]);
