/**
 * PageHeader Component
 *
 * A reusable page header component with title, description, and action buttons.
 * Follows ShadCN UI patterns for consistency.
 */

import type { ReactNode } from "react";
import { Menu, ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  onToggleSidebar?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function PageHeader({
  title,
  description,
  actions,
  onToggleSidebar,
  showBackButton = false,
  onBack,
}: PageHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Burger Menu Button - Only visible on mobile (sm and below) */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="md:hidden text-gray-700 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
      )}

      {/* Back Button */}
      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
      )}

      <div className="flex-1">
        <h1 className="text-xl sm:text-3xl font-medium text-gray-700 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-md">
            {description}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
