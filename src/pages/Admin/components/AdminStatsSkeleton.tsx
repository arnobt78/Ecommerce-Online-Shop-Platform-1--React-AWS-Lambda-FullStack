/**
 * AdminStatsSkeleton Component
 *
 * Loading skeleton for admin dashboard metrics.
 * Provides visual feedback while data is being fetched.
 */

export const AdminStatsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              </div>
            </div>
          ))}
      </div>

      {/* Recent Orders Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {Array(5)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
        </div>
      </div>
    </div>
  );
};
