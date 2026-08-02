/**
 * React Query hooks for return/RMA requests (REQ-1663).
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import {
  getMyReturns,
  createReturnRequest,
  createGuestReturnRequest,
  getAllReturns,
  approveReturn,
  rejectReturn,
  type ReturnRequest,
} from "../services/returnService";
import { toast } from "../lib/toast";

export function useMyReturns(enabled = true): UseQueryResult<ReturnRequest[], Error> {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");
  return useQuery({
    queryKey: ["returns"],
    queryFn: getMyReturns,
    enabled: enabled && hasToken,
    staleTime: Infinity,
    retry: 1,
    refetchOnMount: true,
  });
}

interface CreateReturnVariables {
  orderId: string;
  reason: string;
}

export function useCreateReturnRequest(): UseMutationResult<ReturnRequest, Error, CreateReturnVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: CreateReturnVariables) => createReturnRequest(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      toast.success("Return request submitted", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit return request", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface CreateGuestReturnVariables {
  orderId: string;
  reason: string;
  email: string;
}

// REQ-1671: guest-checkout counterpart of useCreateReturnRequest — invalidates
// the guest-order query (prefix match, regardless of the specific orderId/email
// args it was fetched with) so the lookup page shows the new "requested"
// status immediately, no page refresh.
export function useCreateGuestReturnRequest(): UseMutationResult<ReturnRequest, Error, CreateGuestReturnVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason, email }: CreateGuestReturnVariables) => createGuestReturnRequest(orderId, reason, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-order"] });
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      toast.success("Return request submitted", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit return request", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useAdminReturns(enabled = true): UseQueryResult<ReturnRequest[], Error> {
  const hasToken = typeof window !== "undefined" && !!sessionStorage.getItem("token");
  return useQuery({
    queryKey: ["admin-returns"],
    queryFn: getAllReturns,
    enabled: enabled && hasToken,
    staleTime: Infinity,
    retry: 1,
    refetchOnMount: true,
  });
}

interface ReturnActionVariables {
  id: string;
  adminNote?: string;
}

export function useApproveReturn(): UseMutationResult<ReturnRequest, Error, ReturnActionVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminNote }: ReturnActionVariables) => approveReturn(id, adminNote),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", data.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
      queryClient.invalidateQueries({ queryKey: ["guest-order"] }); // REQ-1671: could be a guest's own order
      queryClient.invalidateQueries({ queryKey: ["admin-products"], refetchType: "active" }); // stock restored
      toast.success("Return approved and refunded", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve return", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useRejectReturn(): UseMutationResult<ReturnRequest, Error, ReturnActionVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminNote }: ReturnActionVariables) => rejectReturn(id, adminNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      queryClient.invalidateQueries({ queryKey: ["guest-order"] }); // REQ-1671: could be a guest's own order
      toast.success("Return request rejected", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject return", { closeButton: true, position: "bottom-right" });
    },
  });
}
