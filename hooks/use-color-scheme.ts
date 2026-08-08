import { useAppTheme } from '@/context/theme-context';

/** App color scheme — account preference (not OS), matching website. */
export function useColorScheme() {
  return useAppTheme().scheme;
}
