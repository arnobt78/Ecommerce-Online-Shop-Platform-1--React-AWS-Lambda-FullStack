import { useEffect } from "react";
import { toast } from "../../../lib/toast";
import { ProductCard, ProductCardSkeleton } from "../../../components";
import { useFeaturedProducts } from "../../../hooks/useProducts";

export const FeaturedProducts = () => {
  // Use React Query hook - automatically handles caching, deduplication, and loading states
  // isLoading is only true when there's NO cached data
  // If cached data exists, it will show immediately even if refetching in background
  const {
    data: products = [],
    isLoading: loading,
    error,
  } = useFeaturedProducts();

  // Show error toast if API call fails (use useEffect to avoid setState during render)
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load featured products", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Only show skeleton if we have no data AND we're loading
  // If cached data exists, show it immediately (even if refetching in background)
  const showSkeleton = loading && products.length === 0;

  return (
    <section className="my-20">
      <h1 className="text-2xl text-center font-medium dark:text-slate-100 mb-5 underline underline-offset-8">
        Featured eBooks
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
        {showSkeleton
          ? Array(3)
              .fill(0)
              .map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))
          : products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
      </div>
    </section>
  );
};
