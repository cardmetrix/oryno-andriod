import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';

import {
  Colors,
  getThemeColors,
  type ColorScheme,
  type ThemeColors,
  type ThemePreference,
} from '@/constants/theme';

const STORAGE_KEY = 'oryno-theme-preference-v1';

type ThemeContextValue = {
  /** Resolved scheme driving the UI (light | dark). */
  scheme: ColorScheme;
  preference: ThemePreference;
  colors: ThemeColors;
  isDark: boolean;
  ready: boolean;
  setPreference: (next: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizePreference(raw?: string | null): ThemePreference {
  // Match website: coerce "system" → light (enableSystem: false).
  if (raw === 'dark') return 'dark';
  return 'light';
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && stored) {
          setPreferenceState(normalizePreference(stored));
        }
      } catch {
        // keep default light
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Drive native chrome (StatusBar, system UI) to match account preference.
    Appearance.setColorScheme?.(preference);
  }, [preference]);

  const setPreference = useCallback(async (next: ThemePreference) => {
    const value = normalizePreference(next);
    setPreferenceState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore persistence failures — in-memory theme still applies
    }
  }, []);

  const scheme: ColorScheme = preference;
  const colors = getThemeColors(scheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      colors,
      isDark: scheme === 'dark',
      ready,
      setPreference,
    }),
    [scheme, preference, colors, ready, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback before provider mounts (shouldn't happen in app tree).
    return {
      scheme: 'light' as const,
      preference: 'light' as const,
      colors: Colors.light,
      isDark: false,
      ready: true,
      setPreference: async () => undefined,
    };
  }
  return ctx;
}
