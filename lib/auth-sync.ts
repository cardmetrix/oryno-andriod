import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { api } from '@/lib/api';
import { getCountryInfo } from '@/lib/country';
import { endpoints } from '@/lib/endpoints';
import { detectUserCountry } from '@/lib/geo';
import type { SyncResponse } from '@/lib/types';
import { markTwoFactorPending } from '@/lib/two-factor';

const COUNTRY_STORAGE_KEY = 'oryno_country';
const LOGIN_ANNOUNCED_KEY = 'oryno_login_announced';

let inflight: Promise<SyncResponse> | null = null;

export async function markLoginAnnounced() {
  try {
    await AsyncStorage.setItem(LOGIN_ANNOUNCED_KEY, '1');
  } catch {
    // ignore
  }
}

export async function clearLoginAnnounced() {
  try {
    await AsyncStorage.removeItem(LOGIN_ANNOUNCED_KEY);
  } catch {
    // ignore
  }
}

export async function wasLoginAnnounced() {
  try {
    return (await AsyncStorage.getItem(LOGIN_ANNOUNCED_KEY)) === '1';
  } catch {
    return false;
  }
}

async function persistCountry(info: ReturnType<typeof getCountryInfo>) {
  try {
    await AsyncStorage.setItem(
      COUNTRY_STORAGE_KEY,
      JSON.stringify({
        countryCode: info.code,
        currency: info.currency,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // ignore
  }
}

export async function syncSessionToDatabase(options?: {
  announceLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  referralCode?: string | null;
}) {
  if (inflight) {
    if (__DEV__) console.log('[ORYNO auth-sync] reusing in-flight sync');
    return inflight;
  }

  inflight = (async () => {
    try {
      let countryCode = options?.countryCode ?? null;
      let forceCountry = Boolean(options?.forceCountry);

      if (!countryCode) {
        // Don't block boot on slow geo — server can still detect by IP.
        const detected = await Promise.race([
          detectUserCountry(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
        ]);
        if (detected?.countryCode) {
          countryCode = detected.countryCode;
          forceCountry = true;
        }
      }

      let referralCode = options?.referralCode ?? null;
      if (!referralCode) {
        const { readStoredReferralCode, clearStoredReferralCode } = await import(
          '@/lib/referrals'
        );
        referralCode = await readStoredReferralCode();
        if (referralCode) {
          // Clear after we attempt attach so we don't re-send forever.
          void clearStoredReferralCode();
        }
      }

      const announceLogin = Boolean(options?.announceLogin);
      if (__DEV__) {
        console.log('[ORYNO auth-sync] syncing session', {
          countryCode,
          forceCountry,
          announceLogin,
          referralCode: Boolean(referralCode),
        });
      }

      const result = await api.post<SyncResponse>(endpoints.auth.sync, {
        countryCode,
        forceCountry,
        announceLogin,
        referralCode: referralCode || undefined,
      });

      const resolvedCode = result.country?.code || result.user?.countryCode || countryCode;
      const info = resolvedCode ? getCountryInfo(resolvedCode) : null;
      if (info) {
        await persistCountry(info);
      }

      if (announceLogin) await markLoginAnnounced();

      if (__DEV__) {
        console.log('[ORYNO auth-sync] sync ok', {
          country: info?.code,
          currency: info?.currency,
        });
      }
      return result;
    } catch (error) {
      if (__DEV__) {
        console.warn('[ORYNO auth-sync] sync failed', error);
      }
      throw error;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** After Clerk session is active: challenge TOTP if enabled, otherwise enter the app. */
export async function continueAfterSignedIn(sync?: SyncResponse | null) {
  let result = sync ?? null;
  if (!result) {
    try {
      result = await syncSessionToDatabase();
    } catch {
      result = null;
    }
  }
  if (result?.twoFactorRequired) {
    markTwoFactorPending();
  }
  router.replace('/(app)/(tabs)');
}
