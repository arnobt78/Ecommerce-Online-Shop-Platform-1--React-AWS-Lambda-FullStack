/**
 * ProductDetailSkeleton Component
 * Skeleton loader that matches the exact layout and dimensions of ProductDetail page
 */

export const ProductDetailSkeleton = () => {
  return (
    <main>
      <section className="py-8 sm:py-10">
        {/* Title and Overview Skeleton */}
        <div className="text-center mb-4">
          <h1 className="pb-2 text-3xl sm:text-4xl text-center font-medium text-gray-700 dark:text-slate-200">
            <div className="h-10 sm:h-12 w-3/4 mx-auto bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
          </h1>
          <p className="mb-2 text-base sm:text-lg text-center text-gray-700 dark:text-slate-200">
            <span className="inline-block h-5 sm:h-6 w-5/6 mx-auto bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
          </p>
        </div>

        {/* Main Content Card Skeleton */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-8">
            {/* Left Section - Image Skeleton */}
            <div className="w-full lg:max-w-xl">
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 w-full">
                <div
                  className="bg-gray-300 dark:bg-gray-600 animate-pulse"
                  style={{
                    height: "400px",
                    minHeight: "400px",
                    display: "block",
                    width: "100%",
                  }}
                  role="img"
                  aria-label="Loading product image"
                ></div>
              </div>
            </div>

            {/* Right Section - Product Details Skeleton */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="space-y-2 sm:space-y-2">
                {/* Price Badge Skeleton */}
                <div>
                  <span className="inline-block h-10 sm:h-12 w-32 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse"></span>
                </div>

                {/* Rating Skeleton */}
                <div className="flex items-center gap-2">
                  <span className="flex items-center">
                    {Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <span
                          key={i}
                          className="w-6 h-6 mr-1 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"
                        ></span>
                      ))}
                  </span>
                  <span className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                </div>

                {/* Badges Skeleton */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-block h-7 w-24 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></span>
                  <span className="inline-block h-7 w-20 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></span>
                  <span className="inline-block h-7 w-16 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></span>
                </div>

                {/* Button Skeleton */}
                <div className="pt-2">
                  <span className="inline-block h-12 w-40 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse"></span>
                </div>

                {/* Divider Skeleton */}
                <div className="border-t border-gray-200 dark:border-slate-700 pt-1 sm:pt-1"></div>

                {/* Description Skeleton */}
                <div>
                  <div className="h-7 w-32 bg-gray-300 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="space-y-2">
                    <span className="block h-5 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                    <span className="block h-5 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                    <span className="block h-5 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                    <span className="block h-5 w-5/6 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                    <span className="block h-5 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                    <span className="block h-5 w-4/5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
