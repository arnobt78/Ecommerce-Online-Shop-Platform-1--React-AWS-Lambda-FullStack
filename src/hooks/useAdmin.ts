/**
 * React Query hooks for admin-related API calls
 * Provides automatic caching, deduplication, and loading states for admin operations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import {
  getAllOrders,
  getAllProducts,
  getAllUsers,
  getAdminStats,
  createProduct,
  updateProduct,
  deleteProduct,
  updateOrderStatus,
  getOrderById,
  refundOrder,
  generateShippingLabel,
  addTrackingNumber,
  updateUser,
  deleteUser,
  getUserById,
  getActivityLogs,
  getAiInsights,
  sendLowStockDigest,
  exportProductsCsv,
  exportOrdersCsv,
  importProductsCsv,
  generateProductDescription,
  type AdminStats,
  type GenerateLabelOptions,
  type OrderTrackingResult,
  type ActivityLogQueryOptions,
  type AiInsightsResult,
  type LowStockDigestResult,
  type ProductCsvImportResult,
  type ProductDescriptionInput,
  type ProductDescriptionResult,
} from "../services/adminService";
import {
  sendShippingNotificationEmail,
  sendDeliveryConfirmationEmail,
  sendOrderCanceledEmail,
  sendOrderRefundedEmail,
  sendAdminRefundProcessedEmail,
  sendAdminLowStockEmail,
  sendAdminOutOfStockEmail,
} from "../services/emailService";
import { invalidateAfterProductChange, invalidateAfterOrderStatusUpdate } from "../utils/queryInvalidation";
import { toast } from "../lib/toast";
import type { ActivityLog, AdminUserDetail, Order, OrderStatus, OrderWithTimeline, Product, User } from "../types";

function isAdminSession(): boolean {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");
  const userRole = typeof window !== "undefined" ? sessionStorage.getItem("userRole") : null;
  return !!hasToken && userRole === "admin";
}

export function useAdminStats(enabled = true): UseQueryResult<AdminStats, Error> {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    enabled: enabled && isAdminSession(),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

export function useAllOrders(enabled = true): UseQueryResult<Order[], Error> {
  return useQuery({
    queryKey: ["admin-orders"],
    queryFn: getAllOrders,
    enabled: enabled && isAdminSession(),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

export function useAllProducts(enabled = true): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: getAllProducts,
    enabled: enabled && isAdminSession(),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false, // Disable to prevent unnecessary refetches
    refetchOnReconnect: true, // Catch updates after connection issues
  });
}

function notifyStockAlert(productId: string, productName: string, stock: number, lowStockThreshold: number): void {
  if (stock === 0) {
    sendAdminOutOfStockEmail({ productId, productName }).catch((emailError) => {
      console.error("Failed to send out-of-stock alert email:", emailError);
    });
  } else if (stock <= lowStockThreshold) {
    sendAdminLowStockEmail({ productId, productName, currentStock: stock, lowStockThreshold }).catch((emailError) => {
      console.error("Failed to send low stock alert email:", emailError);
    });
  }
}

export function useCreateProduct(): UseMutationResult<Product, Error, Record<string, unknown>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: (data) => {
      invalidateAfterProductChange(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Product created successfully", { closeButton: true, position: "bottom-right" });

      // Check for low stock and send admin alert (async, don't block)
      if (data.stock !== undefined && data.stock !== null) {
        notifyStockAlert(data.id, data.name || "Product", data.stock, data.lowStockThreshold || 10);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create product", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface UpdateProductVariables {
  productId: string;
  updates: Record<string, unknown>;
}

export function useUpdateProduct(): UseMutationResult<Product, Error, UpdateProductVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, updates }: UpdateProductVariables) => updateProduct(productId, updates),
    onSuccess: (data, variables) => {
      invalidateAfterProductChange(queryClient);
      queryClient.invalidateQueries({ queryKey: ["product", variables.productId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Product updated successfully", { closeButton: true, position: "bottom-right" });

      if (data.stock !== undefined && data.stock !== null) {
        notifyStockAlert(variables.productId, data.name || "Product", data.stock, data.lowStockThreshold || 10);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update product", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useDeleteProduct(): UseMutationResult<{ message: string; id: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: (_data, productId) => {
      invalidateAfterProductChange(queryClient);
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Product deleted successfully", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete product", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useAllUsers(enabled = true): UseQueryResult<User[], Error> {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: getAllUsers,
    enabled: enabled && isAdminSession(),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

export function useOrder(orderId: string | undefined, enabled = true): UseQueryResult<OrderWithTimeline, Error> {
  return useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () => getOrderById(orderId as string),
    enabled: enabled && isAdminSession() && !!orderId,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

interface UpdateOrderStatusVariables {
  orderId: string;
  status: OrderStatus;
  reason?: string;
}

export function useUpdateOrderStatus(): UseMutationResult<Order, Error, UpdateOrderStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status, reason }: UpdateOrderStatusVariables) => updateOrderStatus(orderId, status, reason),
    onSuccess: (data, variables) => {
      // Ensures both admin dashboard and user dashboard update immediately
      invalidateAfterOrderStatusUpdate(queryClient, data.userId || data.user?.id || null, data.id || null);
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Order status updated successfully", { closeButton: true, position: "bottom-right" });

      // Stock is restored when an order is cancelled — force an immediate product refetch
      if (variables.status === "cancelled") {
        invalidateAfterProductChange(queryClient);
        queryClient.invalidateQueries({ queryKey: ["admin-products"], refetchType: "active" });
      }

      // Send email notifications based on status change (async, don't block)
      const customerEmail = data.user?.email;
      const customerName = data.user?.name || "Customer";
      const { orderId, status: newStatus } = variables;

      if (newStatus === "shipped" && customerEmail) {
        sendShippingNotificationEmail({
          customerEmail,
          customerName,
          orderId,
          trackingNumber: data.trackingNumber || undefined,
        }).catch((emailError) => console.error("Failed to send shipping notification email:", emailError));
      } else if (newStatus === "delivered" && customerEmail) {
        sendDeliveryConfirmationEmail({ customerEmail, customerName, orderId }).catch((emailError) =>
          console.error("Failed to send delivery confirmation email:", emailError),
        );
      } else if (newStatus === "cancelled" && customerEmail) {
        sendOrderCanceledEmail({
          customerEmail,
          customerName,
          orderId,
          refundAmount: data.refundAmount || undefined,
        }).catch((emailError) => console.error("Failed to send order cancellation email:", emailError));
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update order status", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface RefundOrderVariables {
  orderId: string;
  refundData?: { amount?: number; reason?: string };
}

export function useRefundOrder(): UseMutationResult<Order, Error, RefundOrderVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, refundData = {} }: RefundOrderVariables) => refundOrder(orderId, refundData),
    retry: false, // Don't retry refunds automatically - prevent duplicate refunds
    onSuccess: (data, variables) => {
      invalidateAfterOrderStatusUpdate(queryClient, data.userId || data.user?.id || null, data.id || null);
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      const refundAmountLabel = data.refundAmount ? `$${(data.refundAmount / 100).toFixed(2)}` : "full amount";
      toast.success(`Refund processed successfully (${refundAmountLabel})`, {
        closeButton: true,
        position: "bottom-right",
        autoClose: 5000,
      });

      // Send refund confirmation email to customer (async, don't block)
      const customerEmail = data.user?.email;
      const customerName = data.user?.name || "Customer";
      if (customerEmail) {
        sendOrderRefundedEmail({
          customerEmail,
          customerName,
          orderId: variables.orderId,
          refundAmount: data.refundAmount || undefined,
          refundId: data.refundId || undefined,
        }).catch((emailError) => console.error("Failed to send refund confirmation email:", emailError));
      }

      // Stock is restored on refund — force an immediate product refetch
      invalidateAfterProductChange(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin-products"], refetchType: "active" });

      // Send admin alert email (async, don't block)
      sendAdminRefundProcessedEmail({
        orderId: variables.orderId,
        customerName,
        refundAmount: data.refundAmount || undefined,
        refundId: data.refundId || undefined,
      }).catch((emailError) => console.error("Failed to send admin refund alert email:", emailError));
    },
    onError: (error) => {
      toast.error(error.message || "Failed to process refund", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface GenerateShippingLabelVariables {
  orderId: string;
  options?: GenerateLabelOptions;
}

export function useGenerateShippingLabel(): UseMutationResult<OrderTrackingResult, Error, GenerateShippingLabelVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, options = {} }: GenerateShippingLabelVariables) => generateShippingLabel(orderId, options),
    onSuccess: (data, variables) => {
      invalidateAfterOrderStatusUpdate(queryClient, data.userId || data.user?.id || null, data.id || null);
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      const trackingDisplay = data.trackingNumber ? `Tracking: ${data.trackingNumber}` : "Label generated (tracking pending)";
      toast.success(`Shipping label generated! ${trackingDisplay}`, {
        closeButton: true,
        position: "bottom-right",
        autoClose: 5000,
      });

      // Send shipping notification email to customer (async, don't block)
      const customerEmail = data.user?.email;
      const customerName = data.user?.name || "Customer";
      if (customerEmail) {
        sendShippingNotificationEmail({
          customerEmail,
          customerName,
          orderId: variables.orderId,
          trackingNumber: data.trackingNumber || undefined,
          trackingCarrier: data.trackingCarrier || undefined,
          trackingUrl: data.trackingUrl || undefined,
        }).catch((emailError) => console.error("Failed to send shipping notification email:", emailError));
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate shipping label", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface AddTrackingNumberVariables {
  orderId: string;
  trackingNumber: string;
  trackingCarrier?: string;
  status?: string;
}

export function useAddTrackingNumber(): UseMutationResult<OrderTrackingResult, Error, AddTrackingNumberVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, trackingNumber, trackingCarrier, status }: AddTrackingNumberVariables) =>
      addTrackingNumber(orderId, trackingNumber, trackingCarrier, status),
    onSuccess: (data, variables) => {
      invalidateAfterOrderStatusUpdate(queryClient, data.userId || data.user?.id || null, data.id || null);
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"], refetchType: "active" });

      toast.success("Tracking number added successfully", { closeButton: true, position: "bottom-right" });

      // Send shipping notification email to customer (async, don't block)
      const customerEmail = data.user?.email;
      const customerName = data.user?.name || "Customer";
      if (customerEmail) {
        sendShippingNotificationEmail({
          customerEmail,
          customerName,
          orderId: variables.orderId,
          trackingNumber: data.trackingNumber || undefined,
          trackingCarrier: data.trackingCarrier || undefined,
        }).catch((emailError) => console.error("Failed to send shipping notification email:", emailError));
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add tracking number", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useUser(userId: string | undefined, enabled = true): UseQueryResult<AdminUserDetail, Error> {
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getUserById(userId as string),
    enabled: enabled && isAdminSession() && !!userId,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
  });
}

interface UpdateUserVariables {
  userId: string;
  updates: Record<string, unknown>;
}

export function useUpdateUser(): UseMutationResult<User, Error, UpdateUserVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, updates }: UpdateUserVariables) => updateUser(userId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("User updated successfully", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update user", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useDeleteUser(): UseMutationResult<{ message: string; id: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("User deleted successfully", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete user", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useActivityLogs(options: ActivityLogQueryOptions = {}, enabled = true): UseQueryResult<ActivityLog[], Error> {
  return useQuery({
    queryKey: ["admin-activity-logs", options],
    queryFn: () => getActivityLogs(options),
    enabled: enabled && isAdminSession(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

// Parent: REQ-1613 — AI Business Insights panel (Analytics page). `summary` is a
// short text digest built client-side from data already in the TanStack Query
// cache (see analyticsService.buildAiInsightsSummary), so this is the only
// network call the feature makes. 10-minute staleTime mirrors the backend's own
// in-memory response cache (backend/src/services/aiInsights.service.ts) — a
// dashboard revisit within that window never re-triggers a provider call; the
// panel's "Refresh" button calls refetch() to force a new one on demand.
export function useAiInsights(summary: string, enabled = true): UseQueryResult<AiInsightsResult, Error> {
  return useQuery({
    queryKey: ["admin-ai-insights", summary],
    queryFn: () => getAiInsights(summary),
    enabled: enabled && isAdminSession() && summary.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
}

// REQ-1654 — no cache/invalidation needed: sending a digest doesn't change
// any persisted app state, just an outbound email side effect.
export function useSendLowStockDigest(): UseMutationResult<LowStockDigestResult, Error, void> {
  return useMutation({
    mutationFn: () => sendLowStockDigest(),
    onSuccess: (data) => {
      toast.success(`Stock digest sent (${data.outOfStockCount} out of stock, ${data.lowStockCount} low stock)`, { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send stock digest", { closeButton: true, position: "bottom-right" });
    },
  });
}

// REQ-1664 — no cache/invalidation needed: this is a draft the admin edits
// in the form, never persisted state on its own (same pattern as REQ-1651's
// sentiment check and REQ-1652's pricing suggestion).
export function useGenerateProductDescription(): UseMutationResult<ProductDescriptionResult, Error, ProductDescriptionInput> {
  return useMutation({
    mutationFn: (input: ProductDescriptionInput) => generateProductDescription(input),
    onError: (error) => {
      toast.error(error.message || "Failed to generate description", { closeButton: true, position: "bottom-right" });
    },
  });
}

// REQ-1662 — CSV export/import. Exports trigger a real file download (no
// cache entry to invalidate); import mutates the product catalog so it
// invalidates exactly like create/update/delete elsewhere in this file.
export function useExportProductsCsv(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: () => exportProductsCsv(),
    onError: (error) => {
      toast.error(error.message || "Failed to export products", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useExportOrdersCsv(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: () => exportOrdersCsv(),
    onError: (error) => {
      toast.error(error.message || "Failed to export orders", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useImportProductsCsv(): UseMutationResult<ProductCsvImportResult, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (csv: string) => importProductsCsv(csv),
    onSuccess: (data) => {
      invalidateAfterProductChange(queryClient);
      if (data.errors.length === 0) {
        toast.success(`Import complete: ${data.created} created, ${data.updated} updated`, { closeButton: true, position: "bottom-right" });
      } else {
        toast.warning(`Import finished with ${data.errors.length} row error(s): ${data.created} created, ${data.updated} updated`, {
          closeButton: true,
          position: "bottom-right",
          autoClose: 8000,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to import products", { closeButton: true, position: "bottom-right" });
    },
  });
}
