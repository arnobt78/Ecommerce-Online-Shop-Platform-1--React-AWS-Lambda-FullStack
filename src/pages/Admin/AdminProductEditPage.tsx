/**
 * AdminProductEditPage Component
 *
 * Page for editing an existing product.
 * Fetches product data and uses ProductForm component.
 */

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllProducts, useUpdateProduct } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { ProductForm } from "./components/ProductForm";
import { PageHeader, LoadingState, Card } from "../../components/ui";

// Inner component that uses the AdminLayout context
const AdminProductEditContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: products, isLoading: isLoadingProducts } = useAllProducts();
  const updateProductMutation = useUpdateProduct();

  // Find the product to edit
  const product = products?.find((p) => p.id === id);

  // Calculate featured products count (excluding current product if it's featured)
  // Handle both Number (1/0) and Boolean (true/false) for backward compatibility
  const featuredProductsCount = useMemo(() => {
    if (!products) return 0;
    return products.filter((p) => (p.featured_product === 1 || (p.featured_product as unknown) === true) && p.id !== id).length;
  }, [products, id]);

  // Handle form submission
  const handleSubmit = async (formData: Record<string, unknown>) => {
    try {
      await updateProductMutation.mutateAsync({
        productId: id as string,
        updates: formData,
      });
      // Navigate back to products list after successful update
      navigate("/admin/products");
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Update product error:", error);
    }
  };

  // Show error if product not found
  useEffect(() => {
    if (!isLoadingProducts && products && !product) {
      toast.error("Product not found", {
        closeButton: true,
        position: "bottom-right",
      });
      navigate("/admin/products");
    }
  }, [isLoadingProducts, products, product, navigate]);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader title="Edit Product" description="Update product information" onToggleSidebar={toggleSidebar} showBackButton={true} onBack={() => navigate("/admin/products")} />

      {/* Loading State */}
      {isLoadingProducts && <LoadingState message="Loading product..." />}

      {/* Product Form */}
      {!isLoadingProducts && product && (
        <Card className="p-4 sm:p-6">
          <ProductForm product={product} onSubmit={handleSubmit} isLoading={updateProductMutation.isPending} featuredProductsCount={featuredProductsCount} />
        </Card>
      )}
    </div>
  );
};

export const AdminProductEditPage = () => {
  useTitle("Edit Product - Admin");
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
      <AdminProductEditContent />
    </AdminLayout>
  );
};
