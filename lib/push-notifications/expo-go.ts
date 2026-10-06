/** True when running inside Expo Go (remote push unavailable on Android). */
export function isExpoGo() {
  try {
    // Prefer Expo's own helper when available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require('expo') as { isRunningInExpoGo?: () => boolean };
    if (typeof expo.isRunningInExpoGo === 'function') {
      return expo.isRunningInExpoGo();
    }
  } catch {
    // fall through
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      appOwnership?: string | null;
      executionEnvironment?: string;
    };
    return (
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === 'storeClient'
    );
  } catch {
    return false;
  }
}
