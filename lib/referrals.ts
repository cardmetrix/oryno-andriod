import AsyncStorage from '@react-native-async-storage/async-storage';

export const REFERRAL_STORAGE_KEY = 'oryno_referral_code';
export const REFERRAL_BONUS_NGN = 2000;
export const REFERRAL_MIN_TRANSACTIONS = 5;

export function normalizeReferralCode(raw: string | null | undefined) {
  return (raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

export async function persistReferralCode(raw: string | null | undefined) {
  const code = normalizeReferralCode(raw);
  if (!code) return;
  try {
    await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

export async function readStoredReferralCode() {
  try {
    return normalizeReferralCode(await AsyncStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function clearStoredReferralCode() {
  try {
    await AsyncStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}
