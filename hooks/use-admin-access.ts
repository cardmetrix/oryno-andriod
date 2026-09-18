import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useState } from 'react';

import { fetchAdminMe } from '@/lib/admin/api';
import type { AdminMeResponse } from '@/lib/admin/types';
import { useProfile } from '@/hooks/use-profile';

/**
 * Home-banner / entry gate.
 * Only true admins (`users.role === "admin"` or active staff row via `/api/admin/auth/me`).
 * Bootstrap-only emails do not see the dashboard admin component until promoted.
 */
export function useAdminAccess() {
  const { isSignedIn, isLoaded } = useAuth();
  const { profile } = useProfile();
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

  const profileIsAdmin = profile?.role === 'admin';
  const apiIsAdmin = Boolean(me?.isAdmin);
  /** Dashboard admin entry — role admin only (not canBootstrap). */
  const canAccessAdmin = profileIsAdmin || apiIsAdmin;

  return {
    loading,
    me,
    canAccessAdmin,
    isAdmin: canAccessAdmin,
    hasSession: Boolean(me?.session),
    canBootstrap: Boolean(me?.canBootstrap),
    refresh,
  };
}
