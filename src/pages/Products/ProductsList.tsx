import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTitle } from "../../hooks/useTitle";

import { ProductCard, ProductCardSkeleton } from "../../components";
import { FilterBar } from "./components/FilterBar";

import { useFilter } from "../../context";
import { useProducts } from "../../hooks/useProducts";
import { toast } from "../../lib/toast";

export const ProductsList = () => {
  const { products, initialProductList } = useFilter();
  const [show, setShow] = useState(false);
  const search = useLocation().search;
  const searchTerm = new URLSearchParams(search).get("q") || "";
  useTitle("Explore eBooks Collection");

  // Use React Query hook - automatically handles caching, deduplication, and loading states
  // Automatically refetches when searchTerm changes (from URL params)
  const { data: productData = [], isLoading: loading, error } = useProducts(searchTerm);

  // Update FilterContext when product data changes
  // Prioritize showing cached data immediately
  useEffect(() => {
    if (productData.length > 0 || !loading) {
      initialProductList(productData);
    }
  }, [productData, initialProductList, loading]);

  // Show error toast if API call fails (use useEffect to avoid setState during render)
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load products", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  return (
    <main>
      <section className="my-5">
        <div className="my-5 flex justify-between">
          <span className="text-2xl font-medium dark:text-slate-100 mb-5">All eBooks ({products.length})</span>
          <span>
            <button
              onClick={() => setShow(!show)}
              id="dropdownMenuIconButton"
              data-dropdown-toggle="dropdownDots"
              className="inline-flex items-center p-2 text-sm font-medium text-center text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-white dark:bg-gray-600 dark:hover:bg-gray-700"
              type="button"
            >
              <svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
              </svg>
            </button>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {/* Only show skeleton if we have no data AND we're loading */}
          {/* If cached data exists, show it immediately (even if refetching in background) */}
          {loading && products.length === 0
            ? Array(6)
                .fill(0)
                .map((_, index) => <ProductCardSkeleton key={`skeleton-${index}`} />)
            : products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {show && <FilterBar setShow={setShow} />}
    </main>
  );
};
