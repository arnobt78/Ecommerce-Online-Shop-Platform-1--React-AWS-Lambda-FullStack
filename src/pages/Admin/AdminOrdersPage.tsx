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
import { Eye } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllOrders, useUpdateOrderStatus, useAllUsers } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { formatPrice } from "../../utils/formatPrice";
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
  const [orderPendingCancel, setOrderPendingCancel] = useState<string | null>(null);
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
      await updateStatusMutation.mutateAsync({
        orderId: orderPendingCancel,
        status: "cancelled",
      });
      setOrderPendingCancel(null);
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Cancel order error:", error);
    }
  };

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
      cell: (info) => <span className="text-sm font-medium text-gray-700 dark:text-white">${formatPrice(info.getValue())}</span>,
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
        return (
          <StatusBadge
            status={order.status || "pending"}
            asSelect={true}
            onChange={(newStatus) => handleStatusUpdate(order.id, newStatus as OrderStatus)}
            options={statusOptions.filter((opt) => opt.value !== "all")}
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

  // Available status options for filter dropdown
  const filterStatusOptions = [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "refunded", label: "Refunded" }, // Added refunded status option
  ];

  // Status options for status badge select (without "all")
  const statusOptions = filterStatusOptions.filter((opt) => opt.value !== "all");

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader title="Orders Management" description="Manage all orders in your store" onToggleSidebar={toggleSidebar} />

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
            <AlertDialogDescription>This restores stock for every item in the order and emails the customer a cancellation notice. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
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
