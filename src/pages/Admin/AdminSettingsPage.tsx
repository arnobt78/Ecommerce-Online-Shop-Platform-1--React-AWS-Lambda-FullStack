/**
 * AdminSettingsPage Component
 *
 * Settings page for admin panel.
 * Currently displays a note that settings features are not yet implemented,
 * except for the theme mode toggle which is available in the navbar.
 */

import { Info, Palette, History } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { PageHeader, Card } from "../../components/ui";

// Inner component that uses the AdminLayout context
const AdminSettingsContent = () => {
  const { toggleSidebar } = useAdminLayout();

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader title="Settings" description="Manage your admin panel settings" onToggleSidebar={toggleSidebar} />

      {/* Settings Content */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Note Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-sky-900 dark:text-sky-100 mb-2">Settings Features Coming Soon</h3>
                <p className="text-sm text-sky-800 dark:text-sky-200 leading-relaxed">
                  Currently, there are no settings features available in the admin panel. The only setting currently available is the <strong>Theme Mode</strong> toggle (Light/Dark mode), which
                  can be accessed from the main navbar at the top of the page.
                </p>
              </div>
            </div>
          </div>

          {/* Theme Mode Info */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Palette className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-2">Theme Mode (Light/Dark)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                  You can toggle between light and dark mode using the gear icon (⚙️) in the main navigation bar. The theme preference is saved in your browser's local storage and will persist
                  across sessions.
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>Location:</strong> Main navigation bar (top right) → Gear icon (⚙️)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Future Features Placeholder */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-60">
            <div className="flex items-start gap-3">
              <History className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Future Settings Features</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Additional settings features such as profile management, notification preferences, and system configuration will be added in future updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const AdminSettingsPage = () => {
  useTitle("Admin Settings");

  return (
    <AdminLayout>
      <AdminSettingsContent />
    </AdminLayout>
  );
};
