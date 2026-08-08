import { useQuery } from '@tanstack/react-query';

import type { VtpassServiceOption } from '@/components/app/vtpass-service-picker';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function useVtpassServices(identifier: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.vtpass(identifier),
    queryFn: async () => {
      const data = await api.get<{ services?: VtpassServiceOption[] }>(
        `${endpoints.services.vtpassServices}?identifier=${encodeURIComponent(identifier)}`,
      );
      return data.services ?? [];
    },
    enabled,
    staleTime: STALE.catalog,
  });
}

export function useInternationalProductTypes(countryCode: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.internationalProductTypes(countryCode),
    queryFn: async () => {
      const data = await api.get<{
        productTypes?: { product_type_id: number; name: string }[];
        error?: string;
      }>(
        `${endpoints.services.internationalProductTypes}?code=${encodeURIComponent(countryCode)}`,
      );
      return data.productTypes ?? [];
    },
    enabled: enabled && Boolean(countryCode),
    staleTime: STALE.catalog,
  });
}

export function useInternationalOperators(
  countryCode: string,
  productTypeId: number | string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.catalogs.internationalOperators(
      countryCode,
      productTypeId ?? 'none',
    ),
    queryFn: async () => {
      const data = await api.get<{
        operators?: {
          operator_id: string;
          name: string;
          operator_image?: string;
        }[];
      }>(
        `${endpoints.services.internationalOperators}?code=${encodeURIComponent(countryCode)}&product_type_id=${productTypeId}`,
      );
      return data.operators ?? [];
    },
    enabled: enabled && Boolean(countryCode) && productTypeId != null,
    staleTime: STALE.catalog,
  });
}

export function useVariations(serviceId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.variations(serviceId),
    queryFn: async () => {
      const data = await api.get<{
        variations?: {
          variation_code?: string;
          variationCode?: string;
          name: string;
          variation_amount?: string | number;
          amount?: number;
          fixedPrice?: boolean;
        }[];
      }>(`${endpoints.services.variations}?serviceID=${encodeURIComponent(serviceId)}`);
      return data.variations ?? [];
    },
    enabled: enabled && Boolean(serviceId),
    staleTime: STALE.catalog,
  });
}

export function useSocialCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.social,
    queryFn: async () => {
      const data = await api.get<{
        services?: Array<Record<string, unknown>>;
        demo?: boolean;
      }>(endpoints.services.social);
      return data;
    },
    enabled,
    staleTime: STALE.catalog,
  });
}

export function useNumbersServices(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.numbersServices,
    queryFn: async () => {
      const data = await api.get<{
        services?: Array<Record<string, unknown>>;
        countries?: Array<Record<string, unknown>>;
      }>(endpoints.services.numbersServices);
      return data;
    },
    enabled,
    staleTime: STALE.catalog,
  });
}

export function useGiftCardSellCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.giftCardSell,
    queryFn: async () => {
      return api.get<{ brands?: unknown[]; demo?: boolean }>(
        endpoints.services.giftCardSellCatalog,
      );
    },
    enabled,
    staleTime: STALE.catalog,
  });
}

export function useGiftCardCountries(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.giftCardCountries,
    queryFn: async () => {
      return api.get<{ countries?: unknown[]; demo?: boolean }>(
        endpoints.services.giftCardCountries,
      );
    },
    enabled,
    staleTime: STALE.catalog,
  });
}

export function useGiftCardProducts(countryCode: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.giftCardProducts(countryCode),
    queryFn: async () => {
      return api.get<{ products?: unknown[]; demo?: boolean }>(
        `${endpoints.services.giftCardProducts}?countryCode=${encodeURIComponent(countryCode)}`,
      );
    },
    enabled: enabled && Boolean(countryCode),
    staleTime: STALE.catalog,
  });
}

export function useEmailDomains(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalogs.emailDomains,
    queryFn: async () => {
      return api.get<{ domains?: unknown[] }>(endpoints.services.emailsDomains);
    },
    enabled,
    staleTime: STALE.catalog,
  });
}
