/**
 * LoadingState Component
 *
 * A reusable loading state component.
 * Follows ShadCN UI patterns for consistency.
 */

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading...", className = "" }: LoadingStateProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center ${className}`}>
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
