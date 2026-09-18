import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { Appearance, StyleSheet, View } from 'react-native';

import {
  Colors,
  getThemeColors,
  type ColorScheme,
  type ThemeColors,
  type ThemePreference,
} from '@/constants/theme';

export const THEME_STORAGE_KEY = 'oryno-theme-preference-v1';

type ThemeContextValue = {
  /** Resolved scheme driving the UI (light | dark). */
  scheme: ColorScheme;
  preference: ThemePreference;
  colors: ThemeColors;
  isDark: boolean;
  ready: boolean;
  /** True once AsyncStorage has been read (local preference wins over account). */
  hasLocalPreference: boolean;
  transitioning: boolean;
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
  const [hasLocalPreference, setHasLocalPreference] = useState(false);
  const preferenceRef = useRef(preference);
  preferenceRef.current = preference;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && stored) {
          const next = normalizePreference(stored);
          setHasLocalPreference(true);
          setPreferenceState(next);
          Appearance.setColorScheme?.(next);
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
    Appearance.setColorScheme?.(preference);
  }, [preference]);

  const setPreference = useCallback(async (next: ThemePreference) => {
    const value = normalizePreference(next);
    if (value === preferenceRef.current) return;

    preferenceRef.current = value;
    setPreferenceState(value);
    setHasLocalPreference(true);
    Appearance.setColorScheme?.(value);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, value).catch(() => undefined);
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
      hasLocalPreference,
      transitioning: false,
      setPreference,
    }),
    [scheme, preference, colors, ready, hasLocalPreference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
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
      hasLocalPreference: false,
      transitioning: false,
      setPreference: async () => undefined,
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
