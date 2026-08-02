/**
 * React Query hooks for coupons (REQ-1658) — checkout validation (ephemeral,
 * no cache) + admin CRUD (cached + invalidated like every other admin list).
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import {
  validateCoupon,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  type Coupon,
  type CouponValidationResult,
  type CreateCouponInput,
} from "../services/couponService";
import { toast } from "../lib/toast";

interface ValidateCouponVariables {
  code: string;
  subtotalCents: number;
}

// No cache entry — re-validated fresh every time the cart total changes,
// same "ephemeral action" pattern as review-sentiment/ticket-reply-draft.
export function useValidateCoupon(): UseMutationResult<CouponValidationResult, Error, ValidateCouponVariables> {
  return useMutation({
    mutationFn: ({ code, subtotalCents }: ValidateCouponVariables) => validateCoupon(code, subtotalCents),
  });
}

export function useAdminCoupons(enabled = true): UseQueryResult<Coupon[], Error> {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["admin-coupons"],
    queryFn: getAllCoupons,
    enabled: enabled && hasToken,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

export function useCreateCoupon(): UseMutationResult<Coupon, Error, CreateCouponInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon created successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create coupon", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface UpdateCouponVariables {
  id: string;
  input: Partial<CreateCouponInput>;
}

export function useUpdateCoupon(): UseMutationResult<Coupon, Error, UpdateCouponVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateCouponVariables) => updateCoupon(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon updated successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update coupon", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useDeleteCoupon(): UseMutationResult<{ message: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon deleted successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete coupon", { closeButton: true, position: "bottom-right" });
    },
  });
}
