import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORE_KEY = 'oryno_biometric_login';

export type StoredBiometricLogin = {
  identifier: string;
  password: string;
};

export async function saveBiometricLogin(identifier: string, password: string) {
  if (Platform.OS === 'web') return;
  const id = identifier.trim();
  if (!id || !password) return;
  try {
    await SecureStore.setItemAsync(
      STORE_KEY,
      JSON.stringify({ identifier: id, password } satisfies StoredBiometricLogin),
    );
  } catch {
    // device storage unavailable
  }
}

export async function readBiometricLogin(): Promise<StoredBiometricLogin | null> {
  if (Platform.OS === 'web') return null;
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBiometricLogin;
    if (!parsed?.identifier || !parsed?.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearBiometricLogin() {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // ignore
  }
}
