/**
 * ResultsCount Component
 *
 * A reusable component to display filtered results count.
 * Follows ShadCN UI patterns for consistency.
 */

interface ResultsCountProps {
  filteredCount: number;
  totalCount?: number;
  entityName?: string;
  className?: string;
}

export function ResultsCount({
  filteredCount,
  totalCount,
  entityName = "items",
  className = "",
}: ResultsCountProps) {
  return (
    <div className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
      Showing {filteredCount} of {totalCount || 0} {entityName}
    </div>
  );
}
