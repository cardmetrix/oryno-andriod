import { useEffect, useState } from 'react';

import { useAppTheme } from '@/context/theme-context';

/**
 * Web: prefer hydrated account theme; avoid SSR mismatch flashes.
 */
export function useColorScheme() {
  const { scheme } = useAppTheme();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return 'light';
  return scheme;
}
