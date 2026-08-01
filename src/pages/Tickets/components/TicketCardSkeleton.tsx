/**
 * Ticket Card Skeleton Component
 *
 * Skeleton loading component that matches the exact dimensions
 * and layout of the TicketCard component for smooth loading transitions.
 */

export const TicketCardSkeleton = () => {
  return (
    <div className="p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
            <div className="h-5 sm:h-6 w-full sm:w-3/4 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-5 sm:h-6 w-20 bg-gray-300 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
          </div>
          <div className="space-y-2 mb-3">
            <div className="h-4 w-full bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-4 w-full sm:w-5/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="h-3 w-full sm:w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-full sm:w-28 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-full sm:w-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TicketListSkeletonProps {
  count?: number;
}

// Displays multiple ticket card skeletons for list loading state.
export const TicketListSkeleton = ({ count = 3 }: TicketListSkeletonProps) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <TicketCardSkeleton key={index} />
      ))}
    </div>
  );
};
