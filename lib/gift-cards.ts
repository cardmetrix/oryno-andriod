import { openLogoUrls } from '@/lib/brand-logos';

/** Domains used for open logo APIs (Google / DuckDuckGo / Icon Horse). */
const BRAND_LOGO_DOMAINS: Record<string, string> = {
  amazon: 'amazon.com',
  apple: 'apple.com',
  itunes: 'apple.com',
  'google-play': 'play.google.com',
  googleplay: 'google.com',
  steam: 'steampowered.com',
  playstation: 'playstation.com',
  xbox: 'xbox.com',
  roblox: 'roblox.com',
  'razer-gold': 'razer.com',
  razergold: 'razer.com',
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  sephora: 'sephora.com',
  nike: 'nike.com',
  walmart: 'walmart.com',
  target: 'target.com',
  'best-buy': 'bestbuy.com',
  bestbuy: 'bestbuy.com',
  ebay: 'ebay.com',
  gamestop: 'gamestop.com',
  'foot-locker': 'footlocker.com',
  footlocker: 'footlocker.com',
  nordstrom: 'nordstrom.com',
  macys: 'macys.com',
  lululemon: 'lululemon.com',
  visa: 'visa.com',
  amex: 'americanexpress.com',
  vanilla: 'vanillagift.com',
  'green-dot': 'greendot.com',
  greendot: 'greendot.com',
  netspend: 'netspend.com',
};

function brandDomain(slug: string) {
  const key = slug.toLowerCase();
  if (BRAND_LOGO_DOMAINS[key]) return BRAND_LOGO_DOMAINS[key];
  return `${key.replace(/[^a-z0-9-]/g, '')}.com`;
}

/** Remote logo chain for a brand slug (Google / DuckDuckGo / Icon Horse). */
export function giftCardImageFallbacks(slug: string) {
  return openLogoUrls(brandDomain(slug));
}

/**
 * Stable faux % change for display when provider doesn't expose history.
 * Matches website `giftCardRateChangePercent`.
 */
export function giftCardRateChangePercent(slug: string, rate: number | null) {
  if (rate == null || rate <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return Math.round((((hash % 700) - 200) / 100) * 100) / 100;
}

export function resolveGiftCardImageSrc(input: {
  slug?: string;
  image?: string | null;
  fallbacks?: string[];
}) {
  const primary =
    input.image && /^https?:\/\//i.test(input.image) ? input.image : null;
  const chain = [
    primary,
    ...(input.fallbacks || []),
    ...(input.slug ? giftCardImageFallbacks(input.slug) : []),
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);
  return chain;
}
