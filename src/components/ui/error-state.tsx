/**
 * ErrorState Component
 *
 * A reusable error state component.
 * Follows ShadCN UI patterns for consistency.
 */

interface ErrorStateAction {
  label: string;
  onClick: () => void;
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  action?: ErrorStateAction;
  className?: string;
}

export function ErrorState({ message, onRetry, action, className = "" }: ErrorStateProps) {
  // `action` lets a caller override the button label/handler (e.g. "Close" instead
  // of "Retry"); `onRetry` stays as the simple default-labeled retry shortcut.
  const buttonLabel = action?.label ?? "Retry";
  const buttonHandler = action?.onClick ?? onRetry;

  return (
    <div
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}
    >
      <p className="text-red-800 dark:text-red-200 mb-2">{message}</p>
      {buttonHandler && (
        <button
          onClick={buttonHandler}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm"
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
