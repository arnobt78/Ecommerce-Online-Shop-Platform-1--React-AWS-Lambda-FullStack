/**
 * React Query hooks for wishlist/favorites (REQ-1656).
 *
 * Caching Strategy: staleTime Infinity, invalidated only on add/remove — same
 * pattern as useAddresses (REQ-1618).
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { getWishlist, addToWishlist, removeFromWishlist, type WishlistEntry } from "../services/wishlistService";
import { toast } from "../lib/toast";

export function useWishlist(enabled = true): UseQueryResult<WishlistEntry[], Error> {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["wishlist"],
    queryFn: getWishlist,
    enabled: enabled && hasToken,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

// Derives a fast-lookup Set of wishlisted product ids from the cached list —
// lets ProductCard/ProductDetail render the filled/outline heart instantly
// without an extra network round-trip per card.
export function useWishlistedProductIds(): Set<string> {
  const { data: wishlist = [] } = useWishlist();
  return useMemo(() => new Set(wishlist.map((entry) => entry.productId)), [wishlist]);
}

export function useAddToWishlist(): UseMutationResult<WishlistEntry, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addToWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success("Added to wishlist", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add to wishlist", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useRemoveFromWishlist(): UseMutationResult<{ message: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFromWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success("Removed from wishlist", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove from wishlist", { closeButton: true, position: "bottom-right" });
    },
  });
}
