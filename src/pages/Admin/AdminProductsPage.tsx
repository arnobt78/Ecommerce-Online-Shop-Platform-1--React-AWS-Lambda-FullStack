/**
 * AdminProductsPage Component
 *
 * Product management page for admin panel.
 * Displays all products in a table with search, filters, and CRUD operations.
 * Uses React Query for efficient data fetching and caching.
 *
 * Features:
 * - Product list table with search and filters
 * - Create new product button
 * - Edit/Delete actions for each product
 * - Real-time updates with cache invalidation
 */

import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Plus, Eye, Pencil, Trash2, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllProducts, useDeleteProduct } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { getProductImageUrl, getProductImageKey } from "../../utils/productImage";
import { formatPrice } from "../../utils/formatPrice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
} from "../../components/ui";
import type { Product } from "../../types";

const columnHelper = createColumnHelper<Product>();

interface ProductToDelete {
  id: string;
  name: string;
}

// Inner component that uses the AdminLayout context
const AdminProductsContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: products, isLoading, error } = useAllProducts();
  const deleteProductMutation = useDeleteProduct();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterInStock, setFilterInStock] = useState("all"); // "all", "in_stock", "out_of_stock", "featured"
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductToDelete | null>(null);

  // Show error toast if API call fails
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load products", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Filter products based on search query and stock filter
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let filtered = [...products];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (product) => product.name?.toLowerCase().includes(query) || product.overview?.toLowerCase().includes(query) || product.id?.toLowerCase().includes(query),
      );
    }

    // Apply stock filter
    if (filterInStock === "in_stock") {
      filtered = filtered.filter((product) => product.in_stock === true);
    } else if (filterInStock === "out_of_stock") {
      filtered = filtered.filter((product) => product.in_stock === false);
    } else if (filterInStock === "featured") {
      // Filter for featured products (handle both Number 1/0 and Boolean true/false)
      filtered = filtered.filter((product) => product.featured_product === 1 || (product.featured_product as unknown) === true);
    }

    return filtered;
  }, [products, searchQuery, filterInStock]);

  // Open delete confirmation dialog
  const handleDeleteClick = (productId: string, productName: string) => {
    setProductToDelete({ id: productId, name: productName });
    setDeleteDialogOpen(true);
  };

  // Handle delete product confirmation
  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      await deleteProductMutation.mutateAsync(productToDelete.id);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Delete error:", error);
      // Keep dialog open on error so user can try again
    }
  };

  // Table column definitions (@tanstack/react-table, REQ-1611) — cell renderers
  // reproduce the exact previous markup/badges 1:1, only the table engine changed.
  const tableColumns = [
    columnHelper.accessor("name", {
      header: "Name",
      cell: (info) => {
        const product = info.row.original;
        return (
          <div className="flex items-center gap-3">
            {getProductImageUrl(product) && (
              <div className="flex-shrink-0">
                <img
                  key={getProductImageKey(product)}
                  src={getProductImageUrl(product) || undefined}
                  alt={product.name || "Product"}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link to={`/admin/products/${product.id}`} className="text-sm font-medium text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline">
                {product.name || "N/A"}
              </Link>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{product.overview || "No description"}</div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("price", {
      header: "Price",
      cell: (info) => <span className="text-sm font-medium text-gray-700 dark:text-white">${formatPrice(info.getValue())}</span>,
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor(
      (product) => (product.stock !== undefined && product.stock !== null ? Number(product.stock) : product.in_stock ? 999 : 0),
      {
        id: "stock",
        header: "Stock",
        cell: (info) => {
          const product = info.row.original;
          if (product.stock === undefined || product.stock === null) {
            return (
              <StatusBadge
                status={product.in_stock ? "in_stock" : "out_of_stock"}
                customLabels={{ in_stock: "In Stock", out_of_stock: "Out of Stock" }}
              />
            );
          }
          const isOut = product.stock === 0;
          const isLow = !isOut && product.stock <= (product.lowStockThreshold || 10);
          const StockIcon = isOut ? XCircle : isLow ? AlertTriangle : CheckCircle2;
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                isOut ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : isLow ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              }`}
            >
              <StockIcon className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
              {isOut ? "Out of Stock" : isLow ? `Low (${product.stock})` : product.stock}
            </span>
          );
        },
        meta: { cellClassName: "whitespace-nowrap" },
      }
    ),
    columnHelper.accessor("best_seller", {
      header: "Best Seller",
      cell: (info) =>
        info.getValue() ? <StatusBadge status="best_seller" customLabels={{ best_seller: "Best Seller" }} /> : <span className="text-xs text-gray-400 dark:text-gray-500">-</span>,
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor((product) => product.featured_product === 1, {
      id: "featured_product",
      header: "Featured",
      cell: (info) => (info.getValue() ? <StatusBadge status="featured" customLabels={{ featured: "Featured" }} /> : <span className="text-xs text-gray-400 dark:text-gray-500">-</span>),
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const product = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger />
            <DropdownMenuContent>
              <DropdownMenuItem icon={Eye} onClick={() => navigate(`/admin/products/${product.id}`)}>
                View
              </DropdownMenuItem>
              <DropdownMenuItem icon={Pencil} onClick={() => navigate(`/admin/products/${product.id}/edit`)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem icon={Trash2} variant="danger" disabled={deleteProductMutation.isPending} onClick={() => handleDeleteClick(product.id, product.name)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      meta: { cellClassName: "whitespace-nowrap text-sm font-medium" },
    }),
  ];

  // Available filter options
  const filterOptions = [
    { value: "all", label: "All Products" },
    { value: "in_stock", label: "In Stock" },
    { value: "out_of_stock", label: "Out of Stock" },
    { value: "featured", label: "Featured Products" },
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader
        title="Products Management"
        description="Manage all products in your store"
        onToggleSidebar={toggleSidebar}
        actions={
          <button
            onClick={() => navigate("/admin/products/new")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Create Product</span>
          </button>
        }
      />

      {/* Loading State */}
      {isLoading && <LoadingState message="Loading products..." />}

      {/* Error State */}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load products"} />}

      {/* Products Table */}
      {!isLoading && !error && (
        <Card className="p-0">
          {/* Search and Filter Bar */}
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, overview, or ID..."
            filterValue={filterInStock}
            onFilterChange={setFilterInStock}
            filterOptions={filterOptions}
          >
            <ResultsCount filteredCount={filteredProducts.length} totalCount={products?.length || 0} entityName="products" />
          </SearchFilterBar>

          {/* Products Table */}
          {filteredProducts.length === 0 ? (
            <EmptyState message={searchQuery || filterInStock !== "all" ? "No products found matching your filters" : "No products available"} />
          ) : (
            <DataTable
              data={filteredProducts}
              columns={tableColumns}
              defaultSorting={[{ id: "name", desc: false }]}
              onRowHover={(product) => queryClient.setQueryData(["product", product.id], product)}
            />
          )}
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              {productToDelete ? `Are you sure you want to delete "${productToDelete.name}"? This action cannot be undone.` : "Are you sure you want to delete this product? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProductMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteProductMutation.isPending} className="bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600">
              {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const AdminProductsPage = () => {
  useTitle("Admin Products");
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
      <AdminProductsContent />
    </AdminLayout>
  );
};
