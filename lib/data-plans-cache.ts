import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Durable cache for data plan catalogs — mirrors website
 * `lib/telecom/data-plans-cache.ts` (sessionStorage → AsyncStorage).
 */

export type CachedDataPlan = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const PREFIX = 'oryno:data-plans:v2:';
const TTL_MS = 30 * 60 * 1000;

type Envelope = {
  expiresAt: number;
  plans: CachedDataPlan[];
};

function storageKey(cacheKey: string) {
  return `${PREFIX}${cacheKey}`;
}

export async function readDataPlansCache(
  cacheKey: string,
): Promise<CachedDataPlan[] | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope;
    if (
      !parsed?.plans?.length ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }
    return parsed.plans;
  } catch {
    return null;
  }
}

export async function writeDataPlansCache(
  cacheKey: string,
  plans: CachedDataPlan[],
) {
  if (!plans.length) return;
  try {
    const payload: Envelope = {
      expiresAt: Date.now() + TTL_MS,
      plans,
    };
    await AsyncStorage.setItem(storageKey(cacheKey), JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}
