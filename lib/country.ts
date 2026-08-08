export type SupportedCountryCode = 'NG' | 'GH' | 'KE' | 'ZA';

export type CountryInfo = {
  code: SupportedCountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
  locale: string;
};

export const SUPPORTED_COUNTRIES: Record<SupportedCountryCode, CountryInfo> = {
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currency: 'NGN',
    currencySymbol: '₦',
    flagEmoji: '🇳🇬',
    locale: 'en-NG',
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    flagEmoji: '🇬🇭',
    locale: 'en-GH',
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    currencySymbol: 'KSh',
    flagEmoji: '🇰🇪',
    locale: 'en-KE',
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    currencySymbol: 'R',
    flagEmoji: '🇿🇦',
    locale: 'en-ZA',
  },
};

export const DEFAULT_COUNTRY_CODE: SupportedCountryCode = 'NG';

const REGION_FALLBACKS: Record<string, SupportedCountryCode> = {
  BJ: 'NG',
  TG: 'NG',
  BF: 'NG',
  NE: 'NG',
  ML: 'NG',
  SN: 'NG',
  CI: 'NG',
  LR: 'NG',
  SL: 'NG',
  GM: 'NG',
  GN: 'NG',
  GW: 'NG',
  CV: 'NG',
  MR: 'NG',
  UG: 'KE',
  TZ: 'KE',
  RW: 'KE',
  BI: 'KE',
  ET: 'KE',
  SO: 'KE',
  SS: 'KE',
  DJ: 'KE',
  BW: 'ZA',
  NA: 'ZA',
  ZW: 'ZA',
  MZ: 'ZA',
  ZM: 'ZA',
  MW: 'ZA',
  LS: 'ZA',
  SZ: 'ZA',
  AO: 'ZA',
};

export function isSupportedCountryCode(
  code: string | null | undefined,
): code is SupportedCountryCode {
  return Boolean(code && code.toUpperCase() in SUPPORTED_COUNTRIES);
}

export function resolveCountryCode(raw?: string | null): SupportedCountryCode {
  if (!raw) return DEFAULT_COUNTRY_CODE;
  const code = raw.toUpperCase().slice(0, 2);
  if (isSupportedCountryCode(code)) return code;
  return REGION_FALLBACKS[code] ?? DEFAULT_COUNTRY_CODE;
}

export function getCountryInfo(code?: string | null): CountryInfo {
  return SUPPORTED_COUNTRIES[resolveCountryCode(code)];
}
