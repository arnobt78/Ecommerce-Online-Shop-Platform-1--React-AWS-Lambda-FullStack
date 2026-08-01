/**
 * AdminProductCreatePage Component
 *
 * Page for creating a new product.
 * Uses ProductForm component and handles form submission.
 */

import { useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { Menu } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllProducts, useCreateProduct } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { ProductForm } from "./components/ProductForm";

// Inner component that uses the AdminLayout context
const AdminProductCreateContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const navigate = useNavigate();
  const { data: products } = useAllProducts();
  const createProductMutation = useCreateProduct();

  // Calculate featured products count
  // Handle both Number (1/0) and Boolean (true/false) for backward compatibility
  const featuredProductsCount = useMemo(() => {
    if (!products) return 0;
    return products.filter((p) => p.featured_product === 1 || (p.featured_product as unknown) === true).length;
  }, [products]);

  // Handle form submission
  const handleSubmit = async (formData: Record<string, unknown>) => {
    try {
      await createProductMutation.mutateAsync(formData);
      // Navigate back to products list after successful creation
      navigate("/admin/products");
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Create product error:", error);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        {/* Burger Menu Button - Only visible on mobile (sm and below) */}
        <button
          onClick={toggleSidebar}
          className="md:hidden text-gray-700 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-3xl font-medium text-gray-700 dark:text-white">Create New Product</h1>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-md">Add a new product to your store</p>
        </div>
      </div>

      {/* Product Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <ProductForm product={null} onSubmit={handleSubmit} isLoading={createProductMutation.isPending} featuredProductsCount={featuredProductsCount} />
      </div>
    </div>
  );
};

export const AdminProductCreatePage = () => {
  useTitle("Create Product - Admin");
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
      <AdminProductCreateContent />
    </AdminLayout>
  );
};
