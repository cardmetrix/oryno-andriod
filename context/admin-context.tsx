import { createContext, useContext, type ReactNode } from 'react';

import type { AdminSummary } from '@/lib/admin/types';

type AdminContextValue = {
  admin: AdminSummary | null;
  refresh: () => void;
};

const AdminContext = createContext<AdminContextValue>({
  admin: null,
  refresh: () => {},
});

export function AdminProvider({
  admin,
  refresh,
  children,
}: {
  admin: AdminSummary | null;
  refresh: () => void;
  children: ReactNode;
}) {
  return (
    <AdminContext.Provider value={{ admin, refresh }}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
