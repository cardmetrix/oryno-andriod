import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'oryno_2fa_token';

let memoryToken: string | null | undefined;
let pendingChallenge = false;

export function markTwoFactorPending() {
  pendingChallenge = true;
}

export function consumeTwoFactorPending() {
  const next = pendingChallenge;
  pendingChallenge = false;
  return next;
}

export async function getTwoFactorToken(): Promise<string | null> {
  if (memoryToken !== undefined) return memoryToken;
  try {
    memoryToken = (await SecureStore.getItemAsync(STORE_KEY)) || null;
    return memoryToken;
  } catch {
    return null;
  }
}

export async function setTwoFactorToken(token: string) {
  memoryToken = token;
  try {
    await SecureStore.setItemAsync(STORE_KEY, token);
  } catch {
    // in-memory is enough for this session
  }
}

export async function clearTwoFactorToken() {
  memoryToken = null;
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // ignore
  }
}
