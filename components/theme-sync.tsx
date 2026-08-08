import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

/** Pull account theme preference after sign-in so dark mode applies app-wide. */
export function ThemeSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const { setPreference } = useAppTheme();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await api.get<{
          preferences?: { theme?: string };
        }>(endpoints.settings.root);
        if (cancelled) return;
        await setPreference(json.preferences?.theme === 'dark' ? 'dark' : 'light');
      } catch {
        // keep local preference
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setPreference]);

  return null;
}
