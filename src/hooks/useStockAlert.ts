/**
 * React Query hook for the "Notify me" back-in-stock subscription (REQ-1657).
 *
 * No query/invalidation needed — this is a one-way subscribe action with no
 * persisted state the UI reads back (see aiInsights/ticket-sentiment hooks
 * for the same "ephemeral action, no cache entry" pattern).
 */

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { subscribeToStockAlert } from "../services/stockAlertService";
import { toast } from "../lib/toast";

interface CreateStockAlertVariables {
  productId: string;
  email: string;
}

export function useCreateStockAlert(): UseMutationResult<{ message: string }, Error, CreateStockAlertVariables> {
  return useMutation({
    mutationFn: ({ productId, email }: CreateStockAlertVariables) => subscribeToStockAlert(productId, email),
    onSuccess: (data) => {
      toast.success(data.message || "You'll be notified when this product is back in stock.", {
        closeButton: true,
        position: "bottom-right",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to subscribe to stock alert", { closeButton: true, position: "bottom-right" });
    },
  });
}
