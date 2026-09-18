import { useAuth } from '@clerk/clerk-expo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import {
  clearTwoFactorToken,
  consumeTwoFactorPending,
  getTwoFactorToken,
  setTwoFactorToken,
} from '@/lib/two-factor';

type TwoFactorContextValue = {
  ready: boolean;
  required: boolean;
  verified: boolean;
  blocking: boolean;
  verify: (code: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const TwoFactorContext = createContext<TwoFactorContextValue | null>(null);

export function TwoFactorProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);
  const [required, setRequired] = useState(false);
  const [verified, setVerified] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      await clearTwoFactorToken();
      setRequired(false);
      setVerified(true);
      setReady(true);
      return;
    }
    if (consumeTwoFactorPending()) {
      setRequired(true);
      setVerified(false);
      setReady(true);
    }
    try {
      const json = await api.get<{ required?: boolean; verified?: boolean }>(
        endpoints.auth.twoFactorStatus,
      );
      setRequired(Boolean(json.required));
      setVerified(json.required ? Boolean(json.verified) : true);
    } catch {
      const token = await getTwoFactorToken();
      if (token) {
        setRequired(true);
        setVerified(true);
      }
    } finally {
      setReady(true);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, refresh]);

  const verify = useCallback(async (code: string) => {
    const json = await api.post<{ token?: string }>(endpoints.auth.twoFactorVerify, {
      code: code.trim(),
    });
    if (json.token) await setTwoFactorToken(json.token);
    setRequired(true);
    setVerified(true);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      required,
      verified,
      blocking: Boolean(isSignedIn && required && !verified),
      verify,
      refresh,
    }),
    [isSignedIn, ready, required, verified, verify, refresh],
  );

  return <TwoFactorContext.Provider value={value}>{children}</TwoFactorContext.Provider>;
}

export function useTwoFactor() {
  const ctx = useContext(TwoFactorContext);
  if (!ctx) {
    throw new Error('useTwoFactor must be used within TwoFactorProvider');
  }
  return ctx;
}

export function useTwoFactorOptional() {
  return useContext(TwoFactorContext);
}
