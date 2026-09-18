import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

/** Apply account theme only when this device has no local preference yet. */
export function ThemeSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const { ready, hasLocalPreference, setPreference } = useAppTheme();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !ready || hasLocalPreference) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await api.get<{
          preferences?: { theme?: string };
        }>(endpoints.settings.root);
        if (cancelled || hasLocalPreference) return;
        await setPreference(json.preferences?.theme === 'dark' ? 'dark' : 'light');
      } catch {
        // keep local preference
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, ready, hasLocalPreference, setPreference]);

  return null;
}
