import { getCountryInfo, resolveCountryCode } from '@/lib/country';

/** Minimum face amount in local currency for flexible international data. */
const INTL_DATA_MIN: Record<string, number> = {
  GH: 5,
  KE: 50,
};

/** Same special-cases as website; other markets use fund-style presets. */
const INTL_DATA_PRESETS: Record<string, string[]> = {
  KE: ['50', '100', '200', '500', '1000'],
  GH: ['5', '10', '20', '50', '100'],
};

function fundPresetsForCountry(countryCode?: string | null) {
  switch (resolveCountryCode(countryCode)) {
    case 'GH':
      return ['20', '50', '100', '200', '500'];
    case 'KE':
      return ['200', '500', '1000', '2000', '5000'];
    case 'ZA':
      return ['50', '100', '200', '500', '1000'];
    default:
      return ['1000', '2000', '5000', '10000'];
  }
}

export function intlDataMinLocal(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === 'NG') return 50;
  return INTL_DATA_MIN[code] ?? 50;
}

export function intlDataPresets(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === 'KE') return INTL_DATA_PRESETS.KE;
  if (code === 'GH') return INTL_DATA_PRESETS.GH;
  return fundPresetsForCountry(code);
}

export function defaultIntlDataAmount(countryCode?: string | null) {
  const presets = intlDataPresets(countryCode);
  return presets[0] ?? '50';
}

export function intlDataMinError(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  const min = intlDataMinLocal(code);
  const sym = getCountryInfo(code).currencySymbol;
  return `Minimum data amount is ${sym}${min}`;
}

export function intlDataVariationLabel(
  countryCode: string | null | undefined,
  amount: number,
) {
  const sym = getCountryInfo(countryCode).currencySymbol;
  return `${sym}${amount} Data`;
}

export function intlDataCurrencySymbol(countryCode?: string | null) {
  return getCountryInfo(countryCode).currencySymbol;
}

/** Markets that use flexible amount entry for international data (VTpass). */
export function usesFlexibleIntlData(_countryCode?: string | null) {
  return false;
}
