/**
 * Ticket Detail Skeleton Component
 *
 * Skeleton loading component that matches the exact dimensions
 * and layout of the TicketDetailPage for smooth loading transitions.
 */

export const TicketDetailSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Back Button Skeleton */}
      <div className="h-5 w-32 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>

      {/* Ticket Header Card Skeleton */}
      <div className="p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">
            {/* Subject Skeleton */}
            <div className="h-6 sm:h-8 w-full sm:w-3/4 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            {/* Date Row Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="h-4 w-full sm:w-40 bg-gray-300 dark:bg-gray-700 rounded"></div>
              <div className="h-4 w-full sm:w-36 bg-gray-300 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          {/* Badge and Select Skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="h-6 w-20 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
            <div className="h-10 w-full sm:w-40 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
        {/* Customer Info Skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full sm:w-48 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-4 w-full sm:w-56 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      {/* Messages Card Skeleton */}
      <div className="p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800 animate-pulse">
        {/* Messages Header Skeleton */}
        <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
        {/* Message Items Skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                <div className="h-5 w-full sm:w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-full sm:w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-full sm:w-5/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-full sm:w-4/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply Form Card Skeleton */}
      <div className="p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800 animate-pulse">
        {/* Form Header Skeleton */}
        <div className="h-6 w-40 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
        {/* Textarea Skeleton */}
        <div className="h-32 w-full bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
        {/* Button Skeleton */}
        <div className="flex justify-end">
          <div className="h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
};

