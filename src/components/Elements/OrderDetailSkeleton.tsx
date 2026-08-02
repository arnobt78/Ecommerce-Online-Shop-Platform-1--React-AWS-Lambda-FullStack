/**
 * OrderDetailSkeleton Component (REQ-1670)
 * Skeleton loader matching the exact layout/dimensions of OrderDetailPage's
 * Summary + Order Items cards, so only this data-dependent area pulses while
 * loading — the page's back button, title, and static chrome render first.
 */
import { Card } from "../ui";

export const OrderDetailSkeleton = () => {
  return (
    <>
      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div key={i}>
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-5 w-24 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array(2)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="w-16 h-16 rounded-lg bg-gray-300 dark:bg-gray-700 animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-4 w-12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse flex-shrink-0" />
              </div>
            ))}
        </div>
      </Card>
    </>
  );
};
