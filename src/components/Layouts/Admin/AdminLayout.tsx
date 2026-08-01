/**
 * AdminLayout Component
 *
 * Main layout wrapper for admin panel pages.
 * Provides sidebar and main content area.
 * Handles responsive behavior and sidebar state.
 * Uses only browser scrollbar (no inner scrollbars).
 *
 * @param {React.ReactNode} children - Child components to render in main content area
 */

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminLayoutContext } from "./AdminLayoutContext";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      // Auto-close sidebar on mobile when switching to desktop
      if (!mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <AdminLayoutContext.Provider value={{ toggleSidebar }}>
      <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
        {/* Sidebar */}
        <AdminSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onMenuClick={toggleSidebar} />

        {/* Main Content Area - Full width, uses browser scrollbar only */}
        <div className="flex-1 w-full min-w-0 ml-0 md:ml-64">
          {/* Main Content - full width (no max-w cap, unlike customer pages —
              the sidebar already bounds it), extends dynamically with the
              viewport. Horizontal padding centralized here instead of
              per-page. */}
          <main className="w-full py-4 md:py-6 lg:py-8">
            <div className="mx-auto w-full px-2 sm:px-4 xl:px-8">{children}</div>
          </main>
        </div>
      </div>
    </AdminLayoutContext.Provider>
  );
};
