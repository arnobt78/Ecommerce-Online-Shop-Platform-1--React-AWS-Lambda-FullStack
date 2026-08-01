/**
 * AdminProductDetailPage Component
 *
 * Product detail page for admin panel.
 * Displays comprehensive product information including analytics, sales data, and business insights.
 * Uses React Query for efficient data fetching and caching.
 *
 * Features:
 * - Full product details view
 * - Product analytics (purchase count, revenue, sales trends)
 * - QR code display
 * - Product image and information
 * - Stock and inventory management info
 * - Edit/Update button
 * - Real-time updates with cache invalidation
 */

import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, DollarSign, FileText, Bookmark, BarChart3, BookOpen, Pencil } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useProduct } from "../../hooks/useProducts";
import { useAllOrders } from "../../hooks/useAdmin";
import { useReviewsByProduct } from "../../hooks/useReviews";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { ProductQRCode } from "../../components/ProductQRCode";
import { PageHeader, StatusBadge, LoadingState, ErrorState, Card, BookCover, ProductVideo, Sparkline } from "../../components/ui";
import { formatPrice } from "../../utils/formatPrice";
import { getProductImageUrl, getProductImageKey } from "../../utils/productImage";
import { calculateSingleProductAnalytics, type SingleProductAnalytics } from "../../services/analyticsService";
import { Rating } from "../../components";

// Inner component that uses the AdminLayout context
const AdminProductDetailContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch product data
  const { data: product, isLoading: productLoading, error: productError } = useProduct(productId, !!productId);

  // Fetch all orders for analytics
  const { data: orders = [], isLoading: ordersLoading } = useAllOrders();

  // Fetch reviews for rating calculation
  const {
    data: reviewsData = {
      reviews: [],
      ratingStats: { averageRating: 0, reviewCount: 0 },
    },
    isLoading: reviewsLoading,
  } = useReviewsByProduct(productId, !!productId);

  // Calculate product analytics
  const productAnalytics = useMemo<SingleProductAnalytics>(() => {
    if (!product || !orders || orders.length === 0) {
      return {
        productId: productId || null,
        productName: product?.name || "Unknown",
        purchaseCount: 0,
        totalQuantity: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        orders: [],
        salesTrend: [],
        refundedCount: 0,
        cancelledCount: 0,
        refundCancelRate: 0,
      };
    }
    return calculateSingleProductAnalytics(productId || null, orders, product);
  }, [productId, product, orders]);

  // Generate product URL for QR code
  const productUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
    return `${baseUrl}/products/${productId}`;
  }, [productId]);

  // Show error toast if API call fails
  useEffect(() => {
    if (productError) {
      toast.error(productError.message || "Failed to load product details", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [productError]);

  const isLoading = productLoading || ordersLoading || reviewsLoading;
  const error = productError;

  // Use review stats if available, otherwise fall back to product rating
  const displayRating = reviewsData.ratingStats?.averageRating || product?.rating || 0;
  const reviewCount = reviewsData.ratingStats?.reviewCount || 0;

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader
        title="Product Details"
        description="View comprehensive product information and analytics"
        onToggleSidebar={toggleSidebar}
        showBackButton={true}
        onBack={() => navigate("/admin/products")}
      />

      {/* Loading State */}
      {isLoading && <LoadingState message="Loading product details..." />}

      {/* Error State */}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load product details"} />}

      {/* Product Details */}
      {!isLoading && !error && product && (
        <div className="space-y-6">
          {/* Product Overview Card */}
          <Card className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Product Image */}
              <div className="flex-shrink-0">
                <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                  {product.coverColor ? (
                    <div className="flex w-full items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 py-6 dark:from-gray-800 dark:to-gray-950">
                      <div className="aspect-[143/199] w-48 sm:w-56 drop-shadow-[0_18px_20px_rgba(0,0,0,0.25)]">
                        <BookCover
                          variant="fill"
                          coverColor={product.coverColor}
                          coverImage={getProductImageUrl(product) || product.poster}
                          alt={product.name}
                        />
                      </div>
                    </div>
                  ) : (
                    <img
                      className="w-full h-auto rounded-lg object-cover"
                      src={getProductImageUrl(product) || product.poster || undefined}
                      key={getProductImageKey(product)}
                      alt={product.name}
                    />
                  )}
                </div>
                <ProductVideo videoUrl={product.videoUrl} className="mt-4" />
              </div>

              {/* Right: Product Information */}
              <div className="space-y-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-medium text-gray-700 dark:text-white mb-2">{product.name}</h1>
                  {product.overview && <p className="text-sm text-gray-600 dark:text-gray-400">{product.overview}</p>}
                  {product.author && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      <User className="h-3.5 w-3.5 inline mr-1 -mt-0.5" strokeWidth={2} />
                      By {product.author}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div>
                  <span className="inline-flex items-center px-4 py-2 rounded-lg text-2xl font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
                    <DollarSign className="h-5 w-5 mr-1.5" strokeWidth={2} />
                    {formatPrice(product.price)}
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <Rating rating={displayRating} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">({displayRating.toFixed(1)} out of 5)</span>
                  {reviewCount > 0 && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  )}
                </div>

                {/* Product Badges */}
                <div className="flex flex-wrap gap-2">
                  {product.best_seller && <StatusBadge status="best_seller" customLabels={{ best_seller: "Best Seller" }} />}
                  {product.stock != null ? (
                    <StatusBadge
                      status={product.stock === 0 ? "out_of_stock" : product.stock <= (product.lowStockThreshold || 10) ? "low_stock" : "in_stock"}
                      customLabels={{
                        in_stock: `${product.stock} in stock`,
                        low_stock: `Low Stock (${product.stock})`,
                        out_of_stock: "Out of Stock",
                      }}
                    />
                  ) : (
                    <StatusBadge status={product.in_stock ? "in_stock" : "out_of_stock"} />
                  )}
                  {(product.featured_product === 1 || (product.featured_product as unknown) === true) && <StatusBadge status="featured" customLabels={{ featured: "Featured" }} />}
                  {product.size && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-sky-800 dark:bg-blue-900/30 dark:text-sky-300 border border-blue-200 dark:border-blue-800">
                      <FileText className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                      {product.size} MB
                    </span>
                  )}
                  {product.category && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <Bookmark className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                      {product.category}
                    </span>
                  )}
                  {product.level && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      <BarChart3 className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                      {product.level}
                    </span>
                  )}
                  {product.pages && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                      <BookOpen className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                      {product.pages} pages
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Analytics Card */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white">Sales Analytics</h2>
              {/* REQ-1644 — monthly units-sold trend, derived from the same orders list above */}
              {productAnalytics.salesTrend.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Units/mo</span>
                  <Sparkline data={productAnalytics.salesTrend.map((point) => ({ label: point.month, value: point.quantity }))} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-sky-600 dark:text-sky-400">Times Purchased</div>
                <div className="text-2xl font-medium text-sky-900 dark:text-sky-100 mt-1">{productAnalytics.purchaseCount}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-600 dark:text-green-400">Total Quantity Sold</div>
                <div className="text-2xl font-medium text-green-900 dark:text-green-100 mt-1">{productAnalytics.totalQuantity}</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Total Revenue</div>
                <div className="text-2xl font-medium text-amber-900 dark:text-amber-100 mt-1">${productAnalytics.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Order Value</div>
                <div className="text-2xl font-medium text-purple-900 dark:text-purple-100 mt-1">${productAnalytics.averageOrderValue.toFixed(2)}</div>
              </div>
              {/* REQ-1644 — refund/cancellation rate for this product specifically */}
              <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border border-rose-200 dark:border-rose-800">
                <div className="text-sm font-medium text-rose-600 dark:text-rose-400">Refund/Cancel Rate</div>
                <div className="text-2xl font-medium text-rose-900 dark:text-rose-100 mt-1">{productAnalytics.refundCancelRate}%</div>
                <div className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                  {productAnalytics.refundedCount} refunded · {productAnalytics.cancelledCount} cancelled
                </div>
              </div>
            </div>
          </Card>

          {/* Product Information Card */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Product Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Product ID</dt>
                    <dd className="text-sm text-gray-700 dark:text-white font-mono mt-1">{product.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</dt>
                    <dd className="text-sm text-gray-700 dark:text-white mt-1">${formatPrice(product.price)}</dd>
                  </div>
                  {product.stock != null && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stock Quantity</dt>
                      <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.stock}</dd>
                    </div>
                  )}
                  {product.lowStockThreshold !== undefined && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Low Stock Threshold</dt>
                      <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.lowStockThreshold}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      {product.stock != null ? (
                        <StatusBadge
                          status={product.stock === 0 ? "out_of_stock" : product.stock <= (product.lowStockThreshold || 10) ? "low_stock" : "in_stock"}
                          customLabels={{
                            in_stock: "In Stock",
                            low_stock: "Low Stock",
                            out_of_stock: "Out of Stock",
                          }}
                        />
                      ) : (
                        <StatusBadge status={product.in_stock ? "in_stock" : "out_of_stock"} />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Seller</dt>
                    <dd className="mt-1">
                      {product.best_seller ? (
                        <StatusBadge status="best_seller" customLabels={{ best_seller: "Yes" }} />
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">No</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Featured</dt>
                    <dd className="mt-1">
                      {product.featured_product === 1 || (product.featured_product as unknown) === true ? (
                        <StatusBadge status="featured" customLabels={{ featured: "Yes" }} />
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">No</span>
                      )}
                    </dd>
                  </div>
                  {product.size && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">File Size</dt>
                      <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.size} MB</dd>
                    </div>
                  )}
                </dl>
              </div>
              {/* QR Code Column */}
              {(product.qrCode || productUrl) && (
                <div>
                  <ProductQRCode qrCode={product.qrCode} productUrl={productUrl} productName={product.name} productId={product.id} />
                </div>
              )}
            </div>
          </Card>

          {/* Catalog & Inventory Metadata Card (REQ-1616) */}
          {(product.sku || product.isbn || product.publisher || product.publishedYear || product.edition || product.language || product.fileFormat || (product.tags?.length ?? 0) > 0) && (
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Catalog &amp; Inventory Metadata</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {product.sku && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">SKU</dt>
                    <dd className="text-sm text-gray-700 dark:text-white font-mono mt-1">{product.sku}</dd>
                  </div>
                )}
                {product.isbn && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ISBN</dt>
                    <dd className="text-sm text-gray-700 dark:text-white font-mono mt-1">{product.isbn}</dd>
                  </div>
                )}
                {product.publisher && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Publisher</dt>
                    <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.publisher}</dd>
                  </div>
                )}
                {product.publishedYear && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Published Year</dt>
                    <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.publishedYear}</dd>
                  </div>
                )}
                {product.edition && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Edition</dt>
                    <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.edition}</dd>
                  </div>
                )}
                {product.language && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Language</dt>
                    <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.language}</dd>
                  </div>
                )}
                {product.fileFormat && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">File Format</dt>
                    <dd className="text-sm text-gray-700 dark:text-white mt-1">{product.fileFormat}</dd>
                  </div>
                )}
              </div>
              {(product.tags?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</dt>
                  <div className="flex flex-wrap gap-2">
                    {(product.tags || []).map((tag) => (
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Description Card */}
          {product.long_description && (
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Description</h2>
              <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{product.long_description}</p>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/admin/products/${product.id}/edit`)}
              className="px-4 py-2 rounded-lg font-medium bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Pencil className="h-4 w-4 mr-2 inline" strokeWidth={2} />
              Edit Product
            </button>
            <button
              onClick={() => navigate("/admin/products")}
              className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Back to Products
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminProductDetailPage = () => {
  useTitle("Admin Product Details");
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
      <AdminProductDetailContent />
    </AdminLayout>
  );
};
