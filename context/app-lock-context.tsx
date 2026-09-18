import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { api } from '@/lib/api';
import {
  authenticateBiometric,
  getBiometricMeta,
  readBiometricPref,
  writeBiometricPref,
  type BiometricMeta,
} from '@/lib/biometric';
import { endpoints } from '@/lib/endpoints';

const LOCK_AFTER_MS = 1500;

type AppLockContextValue = {
  locked: boolean;
  enabled: boolean;
  ready: boolean;
  meta: BiometricMeta;
  unlock: () => Promise<boolean>;
  setEnabled: (next: boolean) => Promise<{ ok: boolean; error?: string }>;
  refreshMeta: () => Promise<BiometricMeta>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

const DEFAULT_META: BiometricMeta = {
  available: false,
  hasHardware: false,
  enrolled: false,
  kind: 'generic',
  title: 'Biometric unlock',
  subtitle: 'Use this device’s biometrics to unlock ORYNO',
  promptMessage: 'Unlock ORYNO',
};

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [locked, setLocked] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<BiometricMeta>(DEFAULT_META);

  const backgroundedAt = useRef<number | null>(null);
  const skipLockUntil = useRef(0);

  const refreshMeta = useCallback(async () => {
    const next = await getBiometricMeta();
    setMeta(next);
    return next;
  }, []);

  const syncFromServer = useCallback(async (clerkUserId: string) => {
    try {
      const json = await api.get<{ security?: { biometricEnabled?: boolean } }>(
        endpoints.settings.root,
      );
      if (typeof json.security?.biometricEnabled === 'boolean') {
        await writeBiometricPref(clerkUserId, json.security.biometricEnabled);
        return json.security.biometricEnabled;
      }
    } catch {
      // local store is enough for unlock
    }
    return readBiometricPref(clerkUserId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshMeta();

    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      setLocked(false);
      setEnabledState(false);
      setReady(true);
      return;
    }

    setReady(false);
    void (async () => {
      const local = await readBiometricPref(userId);
      const hardware = await getBiometricMeta();
      if (cancelled) return;
      setMeta(hardware);
      setEnabledState(local && hardware.available);
      setLocked(false);
      skipLockUntil.current = Date.now() + 4000;
      setReady(true);
      const remote = await syncFromServer(userId);
      if (cancelled) return;
      setEnabledState(remote && hardware.available);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, refreshMeta, syncFromServer, user?.id]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      if (!enabled || !isSignedIn) return;
      if (Date.now() < skipLockUntil.current) return;
      const leftAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (leftAt && Date.now() - leftAt >= LOCK_AFTER_MS) {
        setLocked(true);
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, isSignedIn]);

  const unlock = useCallback(async () => {
    const result = await authenticateBiometric(meta.promptMessage);
    if (result.success) {
      setLocked(false);
      skipLockUntil.current = Date.now() + 800;
      return true;
    }
    return false;
  }, [meta.promptMessage]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (!userId) return { ok: false, error: 'Not signed in' };
      const hardware = await refreshMeta();

      if (next) {
        if (!hardware.hasHardware) {
          return { ok: false, error: `${hardware.title} is not available on this device.` };
        }
        if (!hardware.enrolled) {
          return {
            ok: false,
            error: `Set up ${hardware.title} in your device settings first.`,
          };
        }
        const result = await authenticateBiometric(hardware.promptMessage);
        if (!result.success) {
          return { ok: false, error: 'Could not verify your identity.' };
        }
      }

      try {
        await api.patch(endpoints.settings.root, { biometricEnabled: next });
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Could not save biometric preference',
        };
      }

      await writeBiometricPref(userId, next);
      setEnabledState(next);
      if (!next) {
        setLocked(false);
        const { clearBiometricLogin } = await import('@/lib/biometric-login');
        await clearBiometricLogin();
      }
      skipLockUntil.current = Date.now() + 4000;
      return { ok: true };
    },
    [refreshMeta, userId],
  );

  const value = useMemo<AppLockContextValue>(
    () => ({
      locked: Boolean(isSignedIn && enabled && locked),
      enabled,
      ready,
      meta,
      unlock,
      setEnabled,
      refreshMeta,
    }),
    [enabled, isSignedIn, locked, meta, ready, refreshMeta, setEnabled, unlock],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error('useAppLock must be used within AppLockProvider');
  }
  return ctx;
}
