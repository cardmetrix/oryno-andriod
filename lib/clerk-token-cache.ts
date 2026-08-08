import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const createTokenCache = () => {
  return {
    getToken: async (key: string) => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    saveToken: async (key: string, value: string) => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // ignore
      }
    },
    clearToken: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // ignore
      }
    },
  };
};

/** SecureStore is not available on web — Clerk falls back to memory/localStorage. */
export const tokenCache = Platform.OS === 'web' ? undefined : createTokenCache();
