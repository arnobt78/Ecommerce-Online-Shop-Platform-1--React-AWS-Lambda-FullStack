/**
 * AdminHistoryPage Component
 *
 * Activity log management page for admin panel.
 * Displays all admin activities (order status changes, product CRUD, user CRUD) in a table.
 * Uses React Query for efficient data fetching and caching.
 *
 * Features:
 * - Activity logs table with search and filters
 * - Filter by entity type (order, product, user)
 * - Filter by action (create, update, delete, status_change)
 * - Real-time updates with cache invalidation
 */

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useActivityLogs } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { DataTable, PageHeader, StatusBadge, LoadingState, ErrorState, EmptyState, Card, ResultsCount } from "../../components/ui";
import type { ActivityLog } from "../../types";

const columnHelper = createColumnHelper<ActivityLog>();

// Fields inside ActivityLog.details vary by entity/action — this is the
// dynamic subset the history table renders. details itself stays
// Record<string, unknown> in the shared type (types/index.ts).
interface ActivityLogDetails {
  productName?: string;
  ticketSubject?: string;
  customerEmail?: string;
  userName?: string;
  deletedUserEmail?: string;
  deletedUserName?: string;
  refundAmount?: number;
  previousStatus?: string;
  newStatus?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  labelGenerated?: boolean;
  refundId?: string;
  updatedFields?: string[];
}

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
const AdminHistoryContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterEntityType, setFilterEntityType] = useState(searchParams.get("entityType") || "all");
  const [filterAction, setFilterAction] = useState(searchParams.get("action") || "all");

  // Build query options from filters - memoized to prevent unnecessary re-renders
  const queryOptions = useMemo(
    () => ({
      entityType: filterEntityType !== "all" ? filterEntityType : undefined,
      action: filterAction !== "all" ? filterAction : undefined,
      limit: 500, // Get more logs for history
    }),
    [filterEntityType, filterAction],
  );

  // Fetch activity logs with filters
  const { data: activityData, isLoading, error, refetch } = useActivityLogs(queryOptions, true);

  // Sync search params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterEntityType !== "all") params.set("entityType", filterEntityType);
    if (filterAction !== "all") params.set("action", filterAction);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filterEntityType, filterAction, setSearchParams]);

  // Show error toast if API call fails
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load activity logs", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Filter logs based on search query - memoized with logs inside
  const filteredLogs = useMemo(() => {
    const logs = activityData || [];
    if (!logs || logs.length === 0) return [];

    let filtered = [...logs];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (log) =>
          log.id?.toLowerCase().includes(query) ||
          log.userEmail?.toLowerCase().includes(query) ||
          log.userName?.toLowerCase().includes(query) ||
          log.entityId?.toLowerCase().includes(query) ||
          log.entityType?.toLowerCase().includes(query) ||
          log.action?.toLowerCase().includes(query) ||
          JSON.stringify(log.details || {})
            .toLowerCase()
            .includes(query),
      );
    }

    return filtered;
  }, [activityData, searchQuery]);

  // Get action badge color - memoized for performance
  const getActionBadgeColor = useCallback((action: string) => {
    const colorMap: Record<string, string> = {
      create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      update: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
      delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      status_change: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return colorMap[action] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }, []);

  // Field name mapping for user-friendly display - memoized for performance
  const getFieldDisplayName = useCallback((fieldName: string) => {
    const fieldNameMap: Record<string, string> = {
      // Product fields
      name: "Name",
      price: "Price",
      stock: "Stock",
      lowStockThreshold: "Low Stock Threshold",
      overview: "Overview",
      long_description: "Long Description",
      image_local: "Image",
      poster: "Poster",
      in_stock: "In Stock",
      best_seller: "Best Seller",
      featured_product: "Featured Product",
      rating: "Rating",
      // User fields
      email: "Email",
      role: "Role",
      // Order fields (if any)
      status: "Status",
      paymentStatus: "Payment Status",
      // Ticket fields
      ticketSubject: "Ticket Subject",
    };
    return fieldNameMap[fieldName] || fieldName;
  }, []);

  // Table column definitions (@tanstack/react-table, REQ-1611)
  const tableColumns = useMemo(
    () => [
      columnHelper.accessor((log) => (log.createdAt ? new Date(log.createdAt).getTime() : 0), {
        id: "createdAt",
        header: "Date & Time",
        cell: (info) => {
          const log = info.row.original;
          if (!log.createdAt) return <span className="text-sm text-gray-700 dark:text-gray-100">N/A</span>;
          const { date, time } = formatDateTwoLines(log.createdAt);
          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-700 dark:text-gray-100 whitespace-nowrap">{date}</span>
              <span className="text-sm text-gray-700 dark:text-gray-100 whitespace-nowrap">at {time}</span>
            </div>
          );
        },
        meta: { cellClassName: "min-w-[180px]" },
      }),
      columnHelper.accessor((log) => log.userName || log.userEmail || "", {
        id: "userName",
        header: "Admin",
        cell: (info) => info.row.original.userName || info.row.original.userEmail || "Unknown",
        meta: { cellClassName: "min-w-[150px] whitespace-nowrap text-sm text-gray-700 dark:text-gray-100" },
      }),
      columnHelper.accessor("action", {
        header: "Action",
        cell: (info) => {
          const log = info.row.original;
          return (
            <StatusBadge
              status={log.action}
              className={getActionBadgeColor(log.action)}
              customLabels={{ create: "Created", update: "Updated", delete: "Deleted", status_change: "Status Changed" }}
            />
          );
        },
        meta: { cellClassName: "min-w-[100px] whitespace-nowrap" },
      }),
      columnHelper.accessor("entityType", {
        header: "Entity",
        cell: (info) => (
          <StatusBadge
            status={info.getValue()}
            className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
            customLabels={{ order: "Order", product: "Product", user: "User", ticket: "Ticket" }}
          />
        ),
        meta: { cellClassName: "min-w-[60px] whitespace-nowrap" },
      }),
      columnHelper.accessor("entityId", {
        header: "Entity ID",
        cell: (info) => <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{info.getValue()?.substring(0, 8)}...</span>,
        meta: { cellClassName: "min-w-[100px] whitespace-nowrap" },
      }),
      columnHelper.display({
        id: "details",
        header: "Details",
        cell: (info) => {
          const log = info.row.original;
          const details = (log.details || {}) as ActivityLogDetails;
          if (!log.details || typeof log.details !== "object") return <span className="text-gray-400">No details</span>;
          return (
            <div className="space-y-1">
              {details.productName && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Product:</span> <span className="text-gray-600 dark:text-gray-400">{details.productName}</span>
                </div>
              )}
              {details.ticketSubject && (
                <div className="truncate">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Ticket:</span> <span className="text-gray-600 dark:text-gray-400">{details.ticketSubject}</span>
                  {details.customerEmail && <span className="text-gray-500 dark:text-gray-500 text-xs ml-2">({details.customerEmail})</span>}
                </div>
              )}
              {details.userName && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">User:</span> <span className="text-gray-600 dark:text-gray-400">{details.userName}</span>
                </div>
              )}
              {(details.deletedUserEmail || details.deletedUserName) && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Deleted User:</span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">{details.deletedUserName || details.deletedUserEmail}</span>
                </div>
              )}
              {details.refundAmount && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Refund Amount:</span> <span className="text-gray-600 dark:text-gray-400">${(details.refundAmount / 100).toFixed(2)}</span>
                </div>
              )}
              {details.previousStatus && details.newStatus && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Status:</span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">
                    {details.previousStatus} → {details.newStatus}
                  </span>
                </div>
              )}
              {details.trackingNumber && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Tracking:</span>{" "}
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {details.trackingNumber}
                    {details.trackingCarrier && ` (${details.trackingCarrier.toUpperCase()})`}
                  </span>
                </div>
              )}
              {details.labelGenerated && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Label:</span> <span className="text-gray-600 dark:text-gray-400 text-xs">Generated via Shippo</span>
                </div>
              )}
              {details.refundId && (
                <div className="truncate">
                  <span className="text-gray-700 dark:text-gray-300">Refund ID:</span> <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{details.refundId}</span>
                </div>
              )}
              {details.updatedFields && Array.isArray(details.updatedFields) && (
                <div>
                  <span className="text-gray-700 dark:text-gray-300">{details.updatedFields.length === 1 ? "Field" : "Fields"} updated:</span>{" "}
                  <span className="text-gray-600 dark:text-gray-400 text-xs">{details.updatedFields.map(getFieldDisplayName).join(", ")}</span>
                </div>
              )}
            </div>
          );
        },
        meta: { cellClassName: "min-w-[300px] text-sm text-gray-600 dark:text-gray-400" },
      }),
    ],
    [getActionBadgeColor, getFieldDisplayName],
  );

  // Filter options - memoized to prevent re-creation
  const entityTypeOptions = useMemo(
    () => [
      { value: "all", label: "All Entities" },
      { value: "order", label: "Orders" },
      { value: "product", label: "Products" },
      { value: "user", label: "Users" },
      { value: "ticket", label: "Tickets" },
    ],
    [],
  );

  const actionOptions = useMemo(
    () => [
      { value: "all", label: "All Actions" },
      { value: "create", label: "Created" },
      { value: "update", label: "Updated" },
      { value: "delete", label: "Deleted" },
      { value: "status_change", label: "Status Changed" },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Management History"
        description="Track all admin activities including order status changes, product management, and user management"
        onToggleSidebar={toggleSidebar}
      />

      <div className="py-6">
        {/* Search, Filters, and Results Count - Same Line */}
        <Card className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Filters - Left Side */}
            <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Search Input */}
              <div className="flex-1 relative min-w-0">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <Search className="h-4 w-4" strokeWidth={2} />
                </span>
                <input
                  type="text"
                  placeholder="Search by admin, entity ID, action, or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                )}
              </div>

              {/* Entity Type Filter */}
              <div className="flex-shrink-0">
                <select
                  value={filterEntityType}
                  onChange={(e) => setFilterEntityType(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  {entityTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Filter */}
              <div className="flex-shrink-0">
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Results Count - Right Side */}
        <div className="my-3">
          <ResultsCount filteredCount={filteredLogs.length} totalCount={activityData?.length || 0} entityName={filteredLogs.length === 1 ? "activity log" : "activity logs"} />
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingState message="Loading activity logs..." />
        ) : error ? (
          <ErrorState message={error.message || "Failed to load activity logs"} onRetry={refetch} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            message="No activity logs found"
            description={
              searchQuery || filterEntityType !== "all" || filterAction !== "all"
                ? "Try adjusting your search or filters"
                : "Activity logs will appear here as admin actions are performed"
            }
          />
        ) : (
          <Card className="p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <DataTable columns={tableColumns} data={filteredLogs} defaultSorting={[{ id: "createdAt", desc: true }]} className="min-w-full" />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// Main component wrapped with AdminLayout
export const AdminHistoryPage = () => {
  useTitle("Management History - Admin");

  return (
    <AdminLayout>
      <AdminHistoryContent />
    </AdminLayout>
  );
};
