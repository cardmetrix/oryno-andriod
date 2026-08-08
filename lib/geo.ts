import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import type { SupportedCountryCode } from '@/lib/country';

export type DetectedCountryPayload = {
  countryCode: SupportedCountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
  detectedIso: string | null;
  source: string;
};

/** Detect country via server Google IP geolocation. */
export async function detectUserCountry(): Promise<DetectedCountryPayload | null> {
  try {
    return await api.get<DetectedCountryPayload>(endpoints.geo.country, {
      auth: false,
    });
  } catch {
    return null;
  }
}
