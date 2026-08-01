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

interface RecommendedProductsResult {
  data: Product[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Derives "You Might Also Like" recommendations from the already-cached full
 * product list (same pattern as useFeaturedProducts) — no extra network call,
 * and it stays in sync automatically whenever the products cache is
 * invalidated by any CRUD mutation elsewhere in the app.
 *
 * Scoring: shared tags (REQ-1616 genre/topic tags) + same category, falling
 * back to rating/best-seller ordering so the section is never empty as long
 * as the catalog has more than one product.
 */
export function useRecommendedProducts(currentProduct: Product | undefined, limit = 10): RecommendedProductsResult {
  const { data: allProducts = [], isLoading, error } = useProducts("");

  if (!currentProduct) {
    return { data: [], isLoading, error };
  }

  const currentTags = new Set(currentProduct.tags || []);

  const scored = allProducts
    .filter((product) => product.id !== currentProduct.id)
    .map((product) => {
      const sharedTagCount = (product.tags || []).filter((tag) => currentTags.has(tag)).length;
      const sameCategory = product.category && product.category === currentProduct.category ? 1 : 0;
      const score = sharedTagCount * 2 + sameCategory;
      return { product, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.product.rating || 0) - (a.product.rating || 0);
    })
    .slice(0, limit)
    .map((entry) => entry.product);

  return { data: scored, isLoading, error };
}
