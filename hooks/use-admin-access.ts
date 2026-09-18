import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useState } from 'react';

import { fetchAdminMe } from '@/lib/admin/api';
import type { AdminMeResponse } from '@/lib/admin/types';

/**
 * Lightweight check for home-banner / entry — does not require passcode session.
 * Shows access when user is an admin (users.role=admin or staff row) or can bootstrap.
 */
export function useAdminAccess() {
  const { isSignedIn, isLoaded } = useAuth();
  const [me, setMe] = useState<AdminMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdminMe();
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canAccessAdmin = Boolean(me?.isAdmin || me?.canBootstrap);

  return {
    loading,
    me,
    canAccessAdmin,
    hasSession: Boolean(me?.session),
    refresh,
  };
}
