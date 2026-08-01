/**
 * React Query hooks for user-related API calls
 * Provides automatic caching, deduplication, and loading states
 */

import { useQuery, useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { getUser, getUserOrders, getOrderDetail, getAddresses, createAddress, updateAddress, deleteAddress } from "../services";
import type { AddressInput } from "../services";
import { toast } from "../lib/toast";
import type { Address } from "../types";

function getSessionUserId(): string | null {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");
  try {
    return hasToken ? JSON.parse(sessionStorage.getItem("cbid") || "null") : null;
  } catch {
    return null;
  }
}

// Fetches current user data. Only fetches if user is logged in (has token).
export function useUser(enabled = true) {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");
  const userId = getSessionUserId();

  return useQuery({
    queryKey: ["user", userId], // Include user ID in key to prevent cross-user cache
    queryFn: getUser,
    enabled: enabled && hasToken, // Only fetch if enabled and user is logged in
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 1, // Retry once on failure
  });
}

// Fetches user orders. Only fetches if user is logged in (has token).
export function useUserOrders(enabled = true) {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");
  const userId = getSessionUserId();

  return useQuery({
    queryKey: ["user-orders", userId], // Include user ID in key to prevent cross-user cache
    queryFn: getUserOrders,
    enabled: enabled && hasToken, // Only fetch if enabled and user is logged in
    staleTime: Infinity, // Data never becomes stale automatically - only invalidated manually
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 1, // Retry once on failure
    // With staleTime: Infinity, data is only stale when manually invalidated.
    // Normal visits use cache; after invalidation it refetches.
    refetchOnMount: true,
  });
}

// Parent: REQ-1617 — single order + status-change timeline for the customer
// order detail page. Named distinctly from useAdmin.ts's admin-only useOrder
// (different query key, different service call — admin can view any order,
// this is ownership-checked). Any mutation that changes an order invalidates
// ["order", id] too — see utils/queryInvalidation.ts.
export function useOrderDetail(orderId: string | undefined, enabled = true) {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderDetail(orderId as string),
    enabled: enabled && hasToken && !!orderId,
    staleTime: 60 * 1000, // order status can change server-side (admin action); refresh reasonably often
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// Parent: REQ-1618 — customer address book (self-service). Not deep-linked by
// id, so a plain ["addresses"] key (no userId suffix) is safe: it's cleared
// like everything else on logout by the query client reset.
export function useAddresses(enabled = true) {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["addresses"],
    queryFn: getAddresses,
    enabled: enabled && hasToken,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

export function useCreateAddress(): UseMutationResult<Address, Error, AddressInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      // Keeps AdminUserDetailPage's embedded address book (REQ-1618) fresh if
      // an admin is viewing this same account's detail page in another tab.
      queryClient.invalidateQueries({ queryKey: ["admin-user", getSessionUserId()] });
      toast.success("Address added successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add address", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface UpdateAddressVariables {
  addressId: string;
  input: Partial<AddressInput>;
}

export function useUpdateAddress(): UseMutationResult<Address, Error, UpdateAddressVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ addressId, input }: UpdateAddressVariables) => updateAddress(addressId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", getSessionUserId()] });
      toast.success("Address updated successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update address", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useDeleteAddress(): UseMutationResult<{ message: string; id: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", getSessionUserId()] });
      toast.success("Address deleted successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete address", { closeButton: true, position: "bottom-right" });
    },
  });
}
