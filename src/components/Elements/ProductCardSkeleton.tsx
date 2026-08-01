export const ProductCardSkeleton = () => {
  return (
    <div className="m-3 flex h-full max-w-sm w-full flex-col bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
      {/* Image Skeleton - matches exact structure with Link wrapper */}
      <div className="relative">
        {/* Best Seller Badge Skeleton - positioned exactly like real badge (top-4 left-2 px-2) */}
        <div className="absolute top-4 left-2 h-6 w-24 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
        {/* Image Skeleton - exact same classes as real image (rounded-t-lg w-full h-64) */}
        <div className="rounded-t-lg w-full h-64 bg-gray-300 dark:bg-gray-700 animate-pulse"></div>
      </div>

      {/* Content wrapper - exact same padding (p-5) */}
      <div className="flex flex-1 flex-col p-5">
        {/* Title Skeleton - matches Link wrapper with h5 text-2xl font-medium tracking-tight (mb-2) - text-2xl with font-medium has larger line-height */}
        <div className="mb-2 h-10 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>

        {/* Overview Skeleton - matches paragraph font-normal (mb-3) - paragraph has line-height that creates more space, typical overview text wraps */}
        <p className="mb-3">
          <span className="block h-5 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse mb-1"></span>
          <span className="block h-5 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse mb-1"></span>
          <span className="block h-5 w-3/4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
        </p>

        {/* Rating Skeleton - matches flex items-center my-2 */}
        <div className="flex items-center my-2">
          <div className="flex">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-5 mr-1 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"
                ></div>
              ))}
          </div>
        </div>

        {/* Price and Button Skeleton - matches flex justify-between items-center */}
        <p className="mt-auto flex justify-between items-center">
          {/* Price Skeleton - matches text-2xl span with $ and price */}
          <span className="text-2xl">
            <span className="inline-block h-8 w-16 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
          </span>
          {/* Button Skeleton - matches inline-flex items-center py-2 px-3 text-sm button - use span to avoid div-in-p error */}
          <span className="inline-flex items-center h-10 w-40 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse"></span>
        </p>
      </div>
    </div>
  );
};
