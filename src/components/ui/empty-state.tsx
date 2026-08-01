/**
 * EmptyState Component
 *
 * A reusable empty state component for when no data is available.
 * Follows ShadCN UI patterns for consistency.
 */

import type { ReactNode } from "react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  message?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode | EmptyStateAction;
  className?: string;
}

function isEmptyStateAction(action: ReactNode | EmptyStateAction): action is EmptyStateAction {
  return (
    typeof action === "object" &&
    action !== null &&
    "label" in action &&
    "onClick" in action &&
    Boolean((action as EmptyStateAction).label) &&
    typeof (action as EmptyStateAction).onClick === "function"
  );
}

export function EmptyState({ message, description, icon, action, className = "" }: EmptyStateProps) {
  // Handle action prop - can be a React element or an object with {label, onClick}
  let actionElement: ReactNode = null;
  if (action) {
    if (isEmptyStateAction(action)) {
      // Convert object to button element
      actionElement = (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
        >
          {action.label}
        </button>
      );
    } else {
      // Already a React element
      actionElement = action;
    }
  }

  return (
    <div className={`p-8 text-center ${className}`}>
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <p className="text-lg font-medium text-gray-700 dark:text-white mb-2">
        {message}
      </p>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {description}
        </p>
      )}
      {actionElement && <div className="mt-4">{actionElement}</div>}
    </div>
  );
}
