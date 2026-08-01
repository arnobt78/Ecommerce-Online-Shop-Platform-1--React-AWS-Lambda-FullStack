/**
 * AdminLayoutContext
 *
 * Context for sharing sidebar toggle function across admin pages.
 * Allows child components to access the sidebar toggle functionality.
 */

import { createContext, useContext } from "react";

export interface AdminLayoutContextValue {
  toggleSidebar: () => void;
}

const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null);

export const useAdminLayout = (): AdminLayoutContextValue => {
  const context = useContext(AdminLayoutContext);
  if (!context) {
    throw new Error("useAdminLayout must be used within AdminLayout");
  }
  return context;
};

export { AdminLayoutContext };

