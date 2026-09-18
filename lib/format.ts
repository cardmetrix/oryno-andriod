export function formatNaira(value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `₦${Number.isFinite(n) ? n.toLocaleString('en-NG') : '0'}`;
}

export function formatMoney(value: number, symbol = '₦') {
  return `${symbol}${value.toLocaleString('en-NG')}`;
}

const COUNTRY_MONEY: Record<string, { symbol: string; locale: string }> = {
  NG: { symbol: '₦', locale: 'en-NG' },
  GH: { symbol: 'GH₵', locale: 'en-GH' },
  KE: { symbol: 'KSh', locale: 'en-KE' },
  ZA: { symbol: 'R', locale: 'en-ZA' },
};

export function formatCountryMoney(
  amount: string | number,
  countryCode?: string | null,
) {
  const info = COUNTRY_MONEY[countryCode || 'NG'] ?? COUNTRY_MONEY.NG;
  const value = typeof amount === 'number' ? amount : Number(amount);
  const formatted = Number.isFinite(value)
    ? Math.abs(value).toLocaleString(info.locale, {
        minimumFractionDigits: countryCode === 'NG' ? 0 : 2,
        maximumFractionDigits: 2,
      })
    : '0';
  return `${info.symbol}${formatted}`;
}

/** Nigeria-priced amount shown in the user's local currency. */
export function formatServiceMoney(
  ngnAmount: string | number,
  countryCode?: string | null,
  ngnToLocal = 1,
) {
  const raw = typeof ngnAmount === 'number' ? ngnAmount : Number(ngnAmount);
  const code = countryCode || 'NG';
  const rate = code === 'NG' ? 1 : ngnToLocal;
  const converted = Number.isFinite(raw) ? raw * rate : 0;
  return formatCountryMoney(converted, code);
}

export function formatUsd(amount: string | number) {
  const value = typeof amount === 'number' ? amount : Number(amount);
  const formatted = Number.isFinite(value)
    ? Math.abs(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00';
  return `$${formatted}`;
}

export function maskBalance(hidden: boolean, formatted: string) {
  return hidden ? '••••••••' : formatted;
}
