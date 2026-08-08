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

export function maskBalance(hidden: boolean, formatted: string) {
  return hidden ? '••••••••' : formatted;
}
