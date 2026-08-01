/**
 * React Query Cache Invalidation Utilities
 *
 * Centralized functions for invalidating React Query caches when data changes.
 * This ensures admin dashboard and user dashboards update immediately after mutations.
 */

import type { QueryClient } from "@tanstack/react-query";

// Invalidate all admin-related queries. Call this when:
// - New order is created
// - New user registers
// - Product is added/removed
// - Any admin-relevant data changes
export function invalidateAdminQueries(queryClient: QueryClient): void {
  // Invalidate admin stats (includes orders, users, products counts)
  queryClient.invalidateQueries({ queryKey: ["admin-stats"] });

  // Invalidate admin orders list
  queryClient.invalidateQueries({ queryKey: ["admin-orders"] });

  // Invalidate admin users list (when new user registers)
  queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  // Invalidate admin products list
  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
}

// Invalidate user orders query. Call this when a new order is created by the current user.
export function invalidateUserOrders(queryClient: QueryClient, userId: string | null = null): void {
  // Get user ID if not provided
  if (!userId) {
    try {
      userId = JSON.parse(sessionStorage.getItem("cbid") || "null");
    } catch {
      userId = null;
    }
  }

  if (userId) {
    queryClient.invalidateQueries({ queryKey: ["user-orders", userId] });
  }
}

// Invalidate all queries after order creation — the most common use case.
// Invalidates both user and admin queries, plus products (stock decremented on order creation).
export function invalidateAfterOrderCreation(queryClient: QueryClient, userId: string | null = null): void {
  invalidateUserOrders(queryClient, userId);
  invalidateAdminQueries(queryClient);
  invalidateAfterProductChange(queryClient);
  // REQ-1618: a new order also belongs in this user's embedded order history
  // on AdminUserDetailPage (["admin-user", userId]).
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
  }
}

// Invalidate all queries after user registration so the admin dashboard shows
// the new user count immediately.
export function invalidateAfterUserRegistration(queryClient: QueryClient): void {
  invalidateAdminQueries(queryClient);
}

// Invalidate all queries after product add/remove/update. Ensures BOTH admin
// and customer-facing pages update immediately.
export function invalidateAfterProductChange(queryClient: QueryClient): void {
  // Invalidate admin queries (affects "Total Products" metric and admin products list)
  invalidateAdminQueries(queryClient);

  // Invalidate admin products query (used by AdminProductsPage)
  queryClient.invalidateQueries({
    queryKey: ["admin-products"],
    exact: false, // Match all queries starting with ["admin-products"]
  });

  // Invalidate customer-facing product queries via prefix matching:
  // - ['products'] - base products query
  // - ['products', searchTerm] - products with search (customer-facing page)
  // - ['product', productId] - individual product detail pages
  // Featured products are filtered from products, so invalidating products
  // automatically updates featured products (no separate query needed).
  queryClient.invalidateQueries({
    queryKey: ["products"],
    exact: false, // Match all queries starting with ["products"]
  });

  // Invalidate all product detail pages (any productId)
  queryClient.invalidateQueries({
    queryKey: ["product"],
    exact: false, // Match all queries starting with ["product"]
  });
}

// Invalidate all queries after order status update — ensures the admin
// dashboard, user dashboard, AND the customer-facing order detail page
// (REQ-1617, ["order", id]) all update immediately when admin changes order status.
export function invalidateAfterOrderStatusUpdate(queryClient: QueryClient, userId: string | null = null, orderId: string | null = null): void {
  // Invalidate admin queries (orders list, stats)
  invalidateAdminQueries(queryClient);

  // Invalidate user orders for the specific user (if provided)
  if (userId) {
    invalidateUserOrders(queryClient, userId);
    // REQ-1618: AdminUserDetailPage embeds this user's orders in ["admin-user", userId] —
    // without this, an admin editing an order in one tab wouldn't see the change
    // reflected on that user's detail page (already open, or navigated to later).
    queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
  } else {
    // If userId not provided, invalidate all user-orders queries
    // (safer but less efficient — prefer passing userId when available)
    queryClient.invalidateQueries({
      queryKey: ["user-orders"],
      exact: false,
    });
    queryClient.invalidateQueries({ queryKey: ["admin-user"], exact: false });
  }

  // Invalidate this specific order's detail+timeline query (customer order detail page)
  if (orderId) {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
  }
}

// Invalidate all queries after review creation/update/deletion — ensures
// product detail pages and admin review pages update immediately.
export function invalidateAfterReviewChange(queryClient: QueryClient, productId: string | null = null): void {
  // Invalidate admin reviews query
  queryClient.invalidateQueries({
    queryKey: ["admin-reviews"],
    exact: false,
  });

  // Invalidate product reviews if productId is provided
  if (productId) {
    queryClient.invalidateQueries({
      queryKey: ["reviews", productId],
    });

    // Also invalidate product detail query to update rating
    queryClient.invalidateQueries({
      queryKey: ["product", productId],
    });
  } else {
    // If productId not provided, invalidate all review queries
    queryClient.invalidateQueries({
      queryKey: ["reviews"],
      exact: false,
    });
  }
}
