import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'oryno_admin_session';

let memoryToken: string | null = null;

export async function getAdminSessionToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    if (Platform.OS === 'web') {
      memoryToken = globalThis.localStorage?.getItem(KEY) ?? null;
      return memoryToken;
    }
    memoryToken = (await SecureStore.getItemAsync(KEY)) ?? null;
    return memoryToken;
  } catch {
    return memoryToken;
  }
}

export async function setAdminSessionToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    if (Platform.OS === 'web') {
      if (token) globalThis.localStorage?.setItem(KEY, token);
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // keep in-memory token
  }
}

export async function clearAdminSessionToken(): Promise<void> {
  await setAdminSessionToken(null);
}
