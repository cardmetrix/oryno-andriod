export type JapServiceRow = {
  service: number;
  name: string;
  type: string;
  category: string;
  platform: string;
  metric: string;
  quality: string;
  rate: number;
  min: number;
  max: number;
  refill?: boolean;
  cancel?: boolean;
  currency: string;
  priceUsdPerThousand?: number;
  priceLocalPerThousand: number;
  sampleQuantity: number;
  samplePriceUsd?: number;
  samplePriceLocal: number;
};

export type BoostConversion = {
  currency: string;
  perUsd: number;
  panelCurrency: string;
  panelPerUsd: number;
};

export type SocialCatalogPayload = {
  demo?: boolean;
  fallback?: boolean;
  platforms?: string[];
  services?: JapServiceRow[];
  conversion?: BoostConversion;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
  USD: '$',
};

export function formatConversionRate(currency: string, perUsd: number) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const amount = perUsd.toLocaleString('en', { maximumFractionDigits: 4 });
  return `1 USD = ${symbol}${amount}`;
}

export function formatLocalMoney(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const formatted = amount.toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export const QUANTITY_FLOOR = 100;

export function isCustomCommentsService(service: {
  type?: string | null;
  quality?: string | null;
  name?: string | null;
}) {
  const hay = `${service.type || ''} ${service.quality || ''} ${service.name || ''}`
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  return /\bcustom\s*comments?\b/.test(hay);
}

export function usdPerThousand(service: JapServiceRow) {
  return service.priceUsdPerThousand ?? 0;
}

export function priceFor(service: JapServiceRow, quantity: number) {
  return (usdPerThousand(service) * quantity) / 1000;
}
