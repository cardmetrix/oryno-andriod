import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORE_KEY = 'oryno_biometric_unlock';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'generic';

export type BiometricMeta = {
  available: boolean;
  hasHardware: boolean;
  enrolled: boolean;
  kind: BiometricKind;
  title: string;
  subtitle: string;
  promptMessage: string;
};

type StoredPref = {
  userId: string;
  enabled: boolean;
};

function emptyMeta(): BiometricMeta {
  return {
    available: false,
    hasHardware: false,
    enrolled: false,
    kind: 'generic',
    title: 'Biometric unlock',
    subtitle: 'Not available on this device',
    promptMessage: 'Unlock ORYNO',
  };
}

function labelsFor(kind: BiometricKind): Pick<BiometricMeta, 'title' | 'subtitle' | 'promptMessage'> {
  if (Platform.OS === 'ios') {
    if (kind === 'face') {
      return {
        title: 'Face ID',
        subtitle: 'Unlock ORYNO and sign in with Face ID on this device',
        promptMessage: 'Unlock ORYNO with Face ID',
      };
    }
    if (kind === 'fingerprint') {
      return {
        title: 'Touch ID',
        subtitle: 'Unlock ORYNO and sign in with Touch ID on this device',
        promptMessage: 'Unlock ORYNO with Touch ID',
      };
    }
  }

  if (kind === 'face') {
    return {
      title: 'Face unlock',
      subtitle: 'Unlock ORYNO with face recognition on this device',
      promptMessage: 'Unlock ORYNO with face recognition',
    };
  }
  if (kind === 'fingerprint') {
    return {
      title: 'Fingerprint',
      subtitle: 'Unlock ORYNO and sign in with your fingerprint',
      promptMessage: 'Unlock ORYNO with your fingerprint',
    };
  }
  if (kind === 'iris') {
    return {
      title: 'Iris unlock',
      subtitle: 'Unlock ORYNO with iris recognition',
      promptMessage: 'Unlock ORYNO with iris recognition',
    };
  }
  return {
    title: 'Biometric unlock',
    subtitle: 'Use this device’s biometrics to unlock ORYNO',
    promptMessage: 'Unlock ORYNO',
  };
}

export async function getBiometricMeta(): Promise<BiometricMeta> {
  if (Platform.OS === 'web') return emptyMeta();

  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);

    let kind: BiometricKind = 'generic';
    if (hasFace && !hasFinger) kind = 'face';
    else if (hasFinger && !hasFace) kind = 'fingerprint';
    else if (hasIris && !hasFace && !hasFinger) kind = 'iris';
    else if (hasFace) kind = Platform.OS === 'ios' ? 'face' : 'generic';
    else if (hasFinger) kind = 'fingerprint';

    return {
      available: hasHardware && enrolled,
      hasHardware,
      enrolled,
      kind,
      ...labelsFor(kind),
    };
  } catch {
    return emptyMeta();
  }
}

export async function authenticateBiometric(promptMessage?: string) {
  if (Platform.OS === 'web') {
    return { success: false as const, error: 'not_available' };
  }

  const meta = await getBiometricMeta();
  if (!meta.available) {
    return {
      success: false as const,
      error: meta.hasHardware ? 'not_enrolled' : 'not_available',
    };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || meta.promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'weak',
    });
    if (result.success) return { success: true as const };
    return { success: false as const, error: result.error || 'authentication_failed' };
  } catch {
    return { success: false as const, error: 'unknown' };
  }
}

export async function readBiometricPref(userId: string): Promise<boolean> {
  if (Platform.OS === 'web' || !userId) return false;
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredPref;
    return parsed.userId === userId && parsed.enabled === true;
  } catch {
    return false;
  }
}

export async function writeBiometricPref(userId: string, enabled: boolean) {
  if (Platform.OS === 'web' || !userId) return;
  try {
    await SecureStore.setItemAsync(
      STORE_KEY,
      JSON.stringify({ userId, enabled } satisfies StoredPref),
    );
  } catch {
    // ignore
  }
}

export function biometricErrorMessage(error: string, meta: BiometricMeta) {
  switch (error) {
    case 'not_enrolled':
      return `Set up ${meta.title} in your device settings first.`;
    case 'not_available':
      return `${meta.title} is not available on this device.`;
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return 'Authentication was cancelled.';
    case 'lockout':
      return 'Too many failed attempts. Try again later or use your device passcode.';
    case 'passcode_not_set':
      return 'Set a device passcode before enabling biometric unlock.';
    default:
      return 'Could not verify your identity. Try again.';
  }
}
