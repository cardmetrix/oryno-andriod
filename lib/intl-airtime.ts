import { getCountryInfo, resolveCountryCode } from '@/lib/country';

/** Suggested top-ups in local currency, mirroring website fund presets. */
const INTL_AIRTIME_PRESETS: Record<string, string[]> = {
  GH: ['20', '50', '100', '200', '500'],
  KE: ['200', '500', '1000', '2000', '5000'],
  ZA: ['10', '20', '50', '100', '200', '500'],
};

/** Minimum face amount in local currency for international airtime top-up. */
const INTL_AIRTIME_MIN: Record<string, number> = {
  GH: 5,
  KE: 50,
  ZA: 10,
};

export function intlAirtimeMinLocal(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === 'NG') return 50;
  return INTL_AIRTIME_MIN[code] ?? 10;
}

export function intlAirtimePresets(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  return INTL_AIRTIME_PRESETS[code] ?? ['1000', '2000', '5000', '10000'];
}

export function defaultIntlAirtimeAmount(countryCode?: string | null) {
  return intlAirtimePresets(countryCode)[0] ?? '50';
}

export function intlAirtimeCurrencySymbol(countryCode?: string | null) {
  return getCountryInfo(countryCode).currencySymbol;
}
