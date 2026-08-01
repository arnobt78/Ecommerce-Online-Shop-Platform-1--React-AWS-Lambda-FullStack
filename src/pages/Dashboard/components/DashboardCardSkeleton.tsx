export const DashboardCardSkeleton = () => {
  return (
    <div className="mb-6 p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800">
      {/* Order Header Skeleton - matches new badge layout */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
          {/* Order ID Badge Skeleton */}
          <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
          {/* Order Date Badge Skeleton */}
          <div className="h-6 w-40 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
          {/* Quantity Badge Skeleton */}
          <div className="h-6 w-24 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
        </div>
        {/* Total Amount Badge Skeleton */}
        <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse"></div>
      </div>

      {/* Product Items Skeleton - typically 1-3 products per order */}
      <div className="space-y-4">
        {Array(2)
          .fill(0)
          .map((_, productIndex) => (
            <div key={productIndex}>
              <div className="flex flex-col sm:flex-row gap-4 p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                {/* Image Skeleton - matches w-32 h-32 rounded-lg */}
                <div className="w-full sm:w-32 h-48 sm:h-32 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse flex-shrink-0"></div>

                {/* Text Content Skeleton */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    {/* Product Name Skeleton - matches text-lg sm:text-xl font-medium */}
                    <div className="h-6 sm:h-7 w-full sm:w-3/4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse mb-3"></div>

                    {/* Badges Skeleton */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className="h-5 w-20 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
                      <div className="h-5 w-16 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
                      <div className="h-5 w-14 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    </div>
                  </div>

                  {/* Price Skeleton */}
                  <div className="mt-2 sm:mt-0">
                    <div className="h-7 sm:h-8 w-20 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Separator line skeleton (not after the last item) */}
              {productIndex < 1 && (
                <div className="my-4 border-t border-gray-200 dark:border-slate-700"></div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
