/**
 * React Query hooks for product-related API calls
 * Provides automatic caching, deduplication, and loading states
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getProductList, getProduct } from "../services";
import type { Product } from "../types";

// Uses Infinity staleTime with manual invalidation for optimal performance —
// normal visits use cache, after invalidation refetchOnMount refetches once.
export function useProducts(searchTerm = ""): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: ["products", searchTerm],
    queryFn: () => getProductList(searchTerm),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

interface FeaturedProductsResult {
  data: Product[];
  isLoading: boolean;
  error: Error | null;
}

// Filters from the products query instead of a separate API call, so featured
// products are always in sync with the main product list/cache.
export function useFeaturedProducts(): FeaturedProductsResult {
  const { data: allProducts = [], isLoading, error } = useProducts("");

  // Handle both Number (1/0) and Boolean (true/false) for backward compatibility
  const featuredProducts = allProducts
    .filter((product) => product.featured_product === 1 || (product.featured_product as unknown) === true)
    .slice(0, 3);

  return {
    data: featuredProducts,
    isLoading,
    error,
  };
}

export function useProduct(productId: string | undefined, enabled = true): UseQueryResult<Product, Error> {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId as string),
    enabled: enabled && !!productId,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}
