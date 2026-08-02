/**
 * AdminOrdersPage Component
 *
 * Orders management page for admin panel.
 * Displays all orders in a table with search, filters, and status update.
 * Uses React Query for efficient data fetching and caching.
 *
 * Features:
 * - Orders list table with search and filters
 * - Status update functionality
 * - View order details
 * - Real-time updates with cache invalidation
 */

import { useState, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Eye, Download } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllOrders, useUpdateOrderStatus, useAllUsers, useExportOrdersCsv } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { formatPrice } from "../../utils/formatPrice";
import { calculateOrderRiskFlags } from "../../services/analyticsService";
import {
  DataTable,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  PageHeader,
  SearchFilterBar,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  Card,
  ResultsCount,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  FormLabel,
  FormTextarea,
} from "../../components/ui";
import type { Order, OrderStatus, User } from "../../types";

const columnHelper = createColumnHelper<Order>();

// Helper function to format date for two-line display
const formatDateTwoLines = (dateString: string | null | undefined): { date: string; time: string } => {
  if (!dateString) return { date: "N/A", time: "" };
  try {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { date: datePart, time: timePart };
  } catch {
    return { date: "N/A", time: "" };
  }
};

// Inner component that uses the AdminLayout context
const AdminOrdersContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: orders, isLoading, error } = useAllOrders();
  const { data: users } = useAllUsers(); // Fetch all users to enrich order data
  const updateStatusMutation = useUpdateOrderStatus();
  const exportCsvMutation = useExportOrdersCsv();
  const [orderPendingCancel, setOrderPendingCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");

  // Create a user lookup map by userId for enriching order data
  const userLookup = useMemo(() => {
    if (!users) return {} as Record<string, User>;
    const lookup: Record<string, User> = {};
    users.forEach((user) => {
      lookup[user.id] = user;
    });
    return lookup;
  }, [users]);

  // Enrich orders with user data from users table (for orders missing name)
  const enrichedOrders = useMemo<Order[]>(() => {
    if (!orders) return [];
    return orders.map((order) => {
      // If order doesn't have user name but we have user data in lookup, enrich it
      const userFromLookup = userLookup[order.userId || order.user?.id || ""];
      if (userFromLookup && (!order.user?.name || order.user?.name === "")) {
        return {
          ...order,
          user: {
            ...order.user,
            name: userFromLookup.name || order.user?.name || "",
            email: order.user?.email || userFromLookup.email || "",
            id: order.userId || order.user?.id || userFromLookup.id,
          },
        };
      }
      return order;
    });
  }, [orders, userLookup]);

  // REQ-1650 — deterministic risk flag per order (not an LLM call), derived
  // from the same already-fetched orders list.
  const orderRiskFlags = useMemo(() => calculateOrderRiskFlags(enrichedOrders), [enrichedOrders]);

  // Sync search params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterStatus !== "all") params.set("status", filterStatus);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filterStatus, setSearchParams]);

  // Show error toast if API call fails
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load orders", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Filter orders based on search query and status filter
  const filteredOrders = useMemo(() => {
    if (!enrichedOrders) return [];

    let filtered = [...enrichedOrders];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (order) => order.id?.toLowerCase().includes(query) || order.user?.name?.toLowerCase().includes(query) || order.user?.email?.toLowerCase().includes(query) || order.userId?.toLowerCase().includes(query),
      );
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((order) => (order.status || "pending") === filterStatus);
    }

    return filtered;
  }, [enrichedOrders, searchQuery, filterStatus]);

  // Handle status update — "cancelled" is confirmed first since it restores
  // stock and emails the customer (same treatment as AdminOrderDetailPage).
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === "cancelled") {
      setOrderPendingCancel(orderId);
      return;
    }
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: newStatus });
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Status update error:", error);
    }
  };

  const handleCancelConfirm = async () => {
    if (!orderPendingCancel) return;
    try {
      // REQ-1639: a paid order is automatically refunded server-side when
      // cancelled (see orders.routes.ts's isCancellingPaidOrder branch) —
      // same behavior as AdminOrderDetailPage's cancel action.
      await updateStatusMutation.mutateAsync({
        orderId: orderPendingCancel,
        status: "cancelled",
        reason: cancelReason.trim() || undefined,
      });
      setOrderPendingCancel(null);
      setCancelReason("");
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Cancel order error:", error);
    }
  };

  // Order currently pending cancellation, if any — used to tailor the confirm
  // dialog's copy when the order was already paid (REQ-1639).
  const orderPendingCancelDetails = useMemo(() => enrichedOrders?.find((o) => o.id === orderPendingCancel) || null, [enrichedOrders, orderPendingCancel]);
  const orderPendingCancelIsPaid = orderPendingCancelDetails?.paymentStatus === "paid" && orderPendingCancelDetails?.status !== "refunded" && !!orderPendingCancelDetails?.paymentIntentId;

  // Table column definitions (@tanstack/react-table, REQ-1611)
  const tableColumns = [
    columnHelper.accessor("id", {
      header: "Order ID",
      cell: (info) => (
        <Link to={`/admin/orders/${info.row.original.id}`} className="text-sm font-medium text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline break-words">
          {info.getValue() || "N/A"}
        </Link>
      ),
      meta: { cellClassName: "min-w-[200px] sm:min-w-[250px]" },
    }),
    columnHelper.accessor((order) => order.user?.name || order.user?.email || "", {
      id: "user",
      header: "Customer",
      cell: (info) => {
        const order = info.row.original;
        return (
          <div className="text-sm">
            {order.userId || order.user?.id ? (
              <Link to={`/admin/users/${order.userId || order.user.id}`} className="font-medium text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline">
                {order.user?.name || order.user?.email || "N/A"}
              </Link>
            ) : (
              <div className="font-medium text-gray-700 dark:text-white">{order.user?.name || order.user?.email || "N/A"}</div>
            )}
            {order.user?.email && order.user?.name && <div className="text-xs text-gray-500 dark:text-gray-400">{order.user.email}</div>}
          </div>
        );
      },
    }),
    columnHelper.accessor((order) => Number(order.amount_paid || 0), {
      id: "amount_paid",
      header: "Amount",
      cell: (info) => {
        const risk = orderRiskFlags.get(info.row.original.id);
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-white">
            ${formatPrice(info.getValue())}
            {/* REQ-1650 — deterministic anomaly flag, review signal only, never an auto-block */}
            {risk?.isRisky && (
              <span
                title={risk.reason || "Unusual order amount"}
                className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              >
                ⚠ Review
              </span>
            )}
          </span>
        );
      },
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor((order) => Number(order.quantity || 0), {
      id: "quantity",
      header: "Items",
      cell: (info) => <span className="text-sm text-gray-700 dark:text-white">{info.getValue()}</span>,
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor((order) => (order.status || "pending").toLowerCase(), {
      id: "status",
      header: "Status",
      cell: (info) => {
        const order = info.row.original;
        // "refunded" is a terminal state reached only via the real Stripe
        // refund flow — shown as a plain badge since it isn't a selectable
        // manual status and there's no valid next transition from it.
        if (order.status === "refunded") {
          return <StatusBadge status="refunded" />;
        }
        return (
          <StatusBadge
            status={order.status || "pending"}
            asSelect={true}
            onChange={(newStatus) => handleStatusUpdate(order.id, newStatus as OrderStatus)}
            options={statusOptions}
            disabled={updateStatusMutation.isPending}
          />
        );
      },
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor((order) => (order.createdAt ? new Date(order.createdAt).getTime() : 0), {
      id: "createdAt",
      header: "Date",
      cell: (info) => {
        const { date, time } = formatDateTwoLines(info.row.original.createdAt);
        return (
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{date}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">at {time}</span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => (
        <DropdownMenu>
          <DropdownMenuTrigger />
          <DropdownMenuContent>
            <DropdownMenuItem icon={Eye} onClick={() => navigate(`/admin/orders/${info.row.original.id}`)}>
              View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      meta: { cellClassName: "whitespace-nowrap text-sm font-medium" },
    }),
  ];

  // Available status options for the filter dropdown — "refunded" is a real,
  // filterable order state (set by the refund flow), so it stays here.
  const filterStatusOptions = [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "refunded", label: "Refunded" },
  ];

  // Status options for the per-row inline status-change select — "refunded"
  // is excluded here (unlike the filter above): it's not a backend-recognized
  // manual status, and refunding must always go through the real Stripe flow
  // (the Refund action on the order detail page, or cancelling a paid order).
  const statusOptions = filterStatusOptions.filter((opt) => opt.value !== "all" && opt.value !== "refunded");

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader
        title="Orders Management"
        description="Manage all orders in your store"
        onToggleSidebar={toggleSidebar}
        actions={
          <button
            onClick={() => exportCsvMutation.mutate()}
            disabled={exportCsvMutation.isPending}
            title="Export orders to CSV"
            className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            <span className="hidden md:inline">Export CSV</span>
          </button>
        }
      />

      {/* Loading State */}
      {isLoading && <LoadingState message="Loading orders..." />}

      {/* Error State */}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load orders"} />}

      {/* Orders Table */}
      {!isLoading && !error && (
        <Card className="p-0">
          {/* Search and Filter Bar */}
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by order ID, customer name, or email..."
            filterValue={filterStatus}
            onFilterChange={setFilterStatus}
            filterOptions={filterStatusOptions}
          >
            <ResultsCount filteredCount={filteredOrders.length} totalCount={enrichedOrders?.length || 0} entityName="orders" />
          </SearchFilterBar>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <EmptyState message={searchQuery || filterStatus !== "all" ? "No orders found matching your filters" : "No orders available"} />
          ) : (
            <DataTable
              data={filteredOrders}
              columns={tableColumns}
              defaultSorting={[{ id: "createdAt", desc: true }]}
              onRowHover={(order) => queryClient.setQueryData(["admin-order", order.id], order)}
            />
          )}
        </Card>
      )}

      {/* Cancel Order Confirmation — opened by the inline status select above */}
      <AlertDialog open={!!orderPendingCancel} onOpenChange={(open: boolean) => !open && setOrderPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel This Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This restores stock for every item in the order and emails the customer a cancellation notice.
              {orderPendingCancelIsPaid && (
                <>
                  {" "}
                  Since this order was already paid, <span className="font-medium">${formatPrice(orderPendingCancelDetails?.amount_paid)}</span> will also be automatically refunded to the
                  customer's original payment method.
                </>
              )}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <FormLabel htmlFor="orders-list-cancel-reason">Reason (optional, internal note)</FormLabel>
            <FormTextarea
              id="orders-list-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation"
              rows={2}
              disabled={updateStatusMutation.isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatusMutation.isPending}>Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} disabled={updateStatusMutation.isPending} className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
              {updateStatusMutation.isPending ? "Cancelling..." : "Cancel Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const AdminOrdersPage = () => {
  useTitle("Admin Orders");
  const navigate = useNavigate();

  // Check if user is admin before rendering
  useEffect(() => {
    const userRole = sessionStorage.getItem("userRole");
    if (userRole !== "admin") {
      toast.error("Admin access required", {
        closeButton: true,
        position: "bottom-right",
      });
      navigate("/products");
    }
  }, [navigate]);

  return (
    <AdminLayout>
      <AdminOrdersContent />
    </AdminLayout>
  );
};
