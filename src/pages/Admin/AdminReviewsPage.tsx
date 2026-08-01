/**
 * Admin Reviews Page
 *
 * Admin-facing page to manage all product reviews.
 * Displays all reviews in a table with search, filters, and status management.
 * Uses reusable ShadCN UI components and React Query hooks.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllReviews, useUpdateReviewStatus } from "../../hooks/useReviews";
import { useAllProducts } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { DataTable, PageHeader, SearchFilterBar, LoadingState, ErrorState, EmptyState, Card, ResultsCount, FormSelect } from "../../components/ui";
import { Rating } from "../../components/Elements/Rating";
import type { Review } from "../../types";

const columnHelper = createColumnHelper<Review>();

// Memoized status options (static data - never changes)
const STATUS_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const FILTER_STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

// Inner component that uses the AdminLayout context
const AdminReviewsContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");

  // Fetch reviews (admin gets all reviews)
  const { data: reviews = [], isLoading, error, refetch } = useAllReviews(filterStatus !== "all" ? filterStatus : null);
  const updateStatusMutation = useUpdateReviewStatus();
  // Reviews only store productId — look up the name so the table shows a
  // real, clickable title instead of a raw UUID.
  const { data: allProducts = [] } = useAllProducts();
  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    allProducts.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [allProducts]);

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
      toast.error(error.message || "Failed to load reviews", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Filter and search reviews
  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (review) => review.userName?.toLowerCase().includes(query) || review.userEmail?.toLowerCase().includes(query) || review.comment?.toLowerCase().includes(query) || review.productId?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [reviews, searchQuery]);

  // Handle status update
  const handleStatusUpdate = useCallback(
    (reviewId: string, newStatus: string) => {
      updateStatusMutation.mutate(
        { reviewId, status: newStatus },
        {
          onSuccess: () => {
            // Cache invalidation handled by mutation hook
          },
        },
      );
    },
    [updateStatusMutation],
  );

  // Format date to two lines (date and time)
  const formatDateTwoLines = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return { datePart: "N/A", timePart: "" };
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
      return { datePart, timePart };
    } catch {
      return { datePart: "N/A", timePart: "" };
    }
  }, []);

  // Table column definitions (@tanstack/react-table, REQ-1611)
  const tableColumns = useMemo(
    () => [
      columnHelper.accessor("userName", {
        header: "User",
        cell: (info) => {
          const review = info.row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              {review.userId ? (
                <Link to={`/admin/users/${review.userId}`} className="text-sm text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline">
                  {review.userName || "Anonymous"}
                </Link>
              ) : (
                <div className="text-sm text-gray-700 dark:text-slate-200">{review.userName || "Anonymous"}</div>
              )}
              <div className="text-sm text-gray-500 dark:text-slate-400">{review.userEmail || ""}</div>
            </div>
          );
        },
        meta: { cellClassName: "whitespace-nowrap" },
      }),
      columnHelper.accessor("rating", {
        header: "Rating",
        cell: (info) => (
          <div>
            <Rating rating={info.getValue()} />
            <div className="text-sm text-gray-600 dark:text-slate-400">{info.getValue()}/5</div>
          </div>
        ),
        meta: { cellClassName: "whitespace-nowrap" },
      }),
      columnHelper.accessor("comment", {
        header: "Comment",
        enableSorting: false,
        cell: (info) => (
          <div className="max-w-lg">
            <p className="text-sm text-gray-700 dark:text-slate-300">{info.getValue()}</p>
          </div>
        ),
      }),
      columnHelper.accessor((review) => (review.productId ? productNameById.get(review.productId) || review.productId : ""), {
        id: "productId",
        header: "Product",
        cell: (info) => {
          const review = info.row.original;
          return review.productId ? (
            <Link to={`/admin/products/${review.productId}`} className="text-sm text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline" onClick={(e) => e.stopPropagation()}>
              {productNameById.get(review.productId) || `${review.productId.substring(0, 8)}...`}
            </Link>
          ) : (
            <span className="text-sm text-gray-500 dark:text-slate-400">—</span>
          );
        },
        meta: { cellClassName: "whitespace-nowrap" },
      }),
      columnHelper.accessor((review) => review.status || "pending", {
        id: "status",
        header: "Status",
        cell: (info) => {
          const review = info.row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <FormSelect value={review.status || "pending"} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleStatusUpdate(review.id, e.target.value)} options={STATUS_OPTIONS} className="min-w-[140px]" />
            </div>
          );
        },
        meta: { cellClassName: "whitespace-nowrap" },
      }),
      columnHelper.accessor((review) => !!review.adminReply, {
        id: "adminReply",
        header: "Response",
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-sky-800 dark:bg-blue-900/30 dark:text-sky-300">
              <MessageSquare className="h-3 w-3" strokeWidth={2} />
              Replied
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
          ),
        meta: { cellClassName: "whitespace-nowrap" },
      }),
      columnHelper.accessor((review) => (review.createdAt ? new Date(review.createdAt).getTime() : 0), {
        id: "createdAt",
        header: "Created",
        cell: (info) => {
          const createdDate = formatDateTwoLines(info.row.original.createdAt);
          return info.row.original.createdAt ? (
            <div>
              <div className="text-sm">{createdDate.datePart}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">at {createdDate.timePart}</div>
            </div>
          ) : (
            "N/A"
          );
        },
        meta: { cellClassName: "whitespace-nowrap text-sm text-gray-600 dark:text-slate-400" },
      }),
    ],
    [handleStatusUpdate, formatDateTwoLines, productNameById],
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState message="Loading reviews..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message="Failed to load reviews" onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="">
      <PageHeader title="Product Reviews" description="Manage and moderate product reviews" onToggleSidebar={toggleSidebar} />

      {/* Search and Filter Bar */}
      <Card className="my-3 p-0">
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by user, email, comment, or product ID..."
          filterValue={filterStatus}
          onFilterChange={setFilterStatus}
          filterOptions={FILTER_STATUS_OPTIONS}
        />
      </Card>

      {/* Results Count */}
      <ResultsCount className="mb-3" filteredCount={filteredReviews.length} totalCount={reviews.length} entityName="reviews" />

      {/* Reviews Table */}
      {filteredReviews.length === 0 ? (
        <Card>
          <EmptyState message="No Reviews Found" description={searchQuery || filterStatus !== "all" ? "Try adjusting your search or filters" : "No reviews have been submitted yet"} />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            data={filteredReviews}
            columns={tableColumns}
            defaultSorting={[{ id: "createdAt", desc: true }]}
            onRowClick={(review) => navigate(`/admin/reviews/${review.id}`)}
            onRowHover={(review) => queryClient.setQueryData(["admin-review", review.id], review)}
          />
        </Card>
      )}
    </div>
  );
};

// Main component that wraps AdminReviewsContent with AdminLayout
export const AdminReviewsPage = () => {
  useTitle("Admin - Reviews");
  return (
    <AdminLayout>
      <AdminReviewsContent />
    </AdminLayout>
  );
};
