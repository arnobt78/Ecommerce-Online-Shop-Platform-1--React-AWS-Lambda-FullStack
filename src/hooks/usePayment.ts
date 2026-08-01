/**
 * React Query hooks for payment operations
 * Provides automatic caching, deduplication, and loading states for Stripe payments
 */

import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { createPaymentIntent, verifyPaymentStatus, type PaymentIntentResult, type PaymentStatus } from "../services/paymentService";
import { toast } from "../lib/toast";
import type { CartItem } from "../types";

interface CreatePaymentIntentVariables {
  amount: number;
  cartList: CartItem[];
  user: { id?: string; email?: string; name?: string };
}

interface UseCreatePaymentIntentOptions {
  onSuccess?: (data: PaymentIntentResult) => void;
  onError?: (error: Error) => void;
}

export function useCreatePaymentIntent(
  options: UseCreatePaymentIntentOptions = {},
): UseMutationResult<PaymentIntentResult, Error, CreatePaymentIntentVariables> {
  return useMutation({
    mutationFn: ({ amount, cartList, user }: CreatePaymentIntentVariables) => createPaymentIntent(amount, cartList, user),
    retry: false, // Don't retry automatically - prevent hundreds of calls
    onSuccess: (data) => {
      options.onSuccess?.(data);
    },
    onError: (error) => {
      console.error("Payment intent creation error:", error);
      toast.error(error.message || "Failed to create payment intent", {
        closeButton: true,
        position: "bottom-right",
      });
      options.onError?.(error);
    },
  });
}

export function usePaymentStatus(paymentIntentId: string | null | undefined, enabled = true): UseQueryResult<PaymentStatus, Error> {
  return useQuery({
    queryKey: ["payment-status", paymentIntentId],
    queryFn: () => verifyPaymentStatus(paymentIntentId as string),
    enabled: enabled && !!paymentIntentId,
    staleTime: Infinity, // Payment status never changes once verified - only invalidated manually
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2, // Retry twice on failure
    // With staleTime: Infinity, data is only stale when manually invalidated.
    // refetchOnMount lets it refetch when stale (post-invalidation) but skip refetch when fresh.
    refetchOnMount: true,
  });
}
