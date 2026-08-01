import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { DollarSign, Star, XCircle, AlertTriangle, CheckCircle2, FileText, Bookmark, BarChart3, BookOpen, User, ShoppingCart, Trash2, Barcode, Hash, Building2, Calendar, Layers, Globe, Tag } from "lucide-react";
import { toast } from "../lib/toast";
import { useTitle } from "../hooks/useTitle";
import {
  Rating,
  ProductDetailSkeleton,
  ReviewList,
  ReviewForm,
  ReviewListSkeleton,
} from "../components";
import { ProductQRCode } from "../components/ProductQRCode";
import { BookCover, ProductVideo, ProductReel } from "../components/ui";
import { useCart } from "../context";
import { useProduct, useRecommendedProducts } from "../hooks/useProducts";
import { useUserOrders } from "../hooks/useUser";
import {
  useReviewsByProduct,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from "../hooks/useReviews";
import { getProductImageUrl, getProductImageKey } from "../utils/productImage";
import { Card } from "../components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import type { Product, Review } from "../types";

export const ProductDetail = () => {
  const { cartList, addToCart, removeFromCart } = useCart();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);
  const { id } = useParams();

  // Get current user ID
  const currentUserId: string | null =
    typeof window !== "undefined"
      ? JSON.parse(sessionStorage.getItem("cbid") || "null")
      : null;

  // Use React Query hooks - automatically handles caching, deduplication, and loading states
  const {
    data: product = {} as Product,
    isLoading: loading,
    error,
  } = useProduct(id, !!id);

  // Fetch reviews for this product
  const {
    data: reviewsData = {
      reviews: [],
      ratingStats: { averageRating: 0, reviewCount: 0 },
    },
    isLoading: reviewsLoading,
  } = useReviewsByProduct(id, !!id);

  // Fetch user orders to check if they can review
  const { data: userOrders = [] } = useUserOrders();

  // "You Might Also Like" — derived from the already-cached product list, no extra fetch.
  const { data: recommendedProducts } = useRecommendedProducts(product.id ? product : undefined);

  // Mutations
  const createReviewMutation = useCreateReview();
  const updateReviewMutation = useUpdateReview();
  const deleteReviewMutation = useDeleteReview();

  useTitle(product.name);

  // Check if user has ordered this product
  const hasOrderedProduct = useMemo(() => {
    if (!userOrders || userOrders.length === 0) return false;
    return userOrders.some((order) =>
      order.cartList?.some((item) => item.id === id),
    );
  }, [userOrders, id]);

  // Get order ID for review (first order containing this product)
  const orderIdForReview = useMemo(() => {
    if (!hasOrderedProduct) return null;
    const order = userOrders.find((order) =>
      order.cartList?.some((item) => item.id === id),
    );
    return order?.id || null;
  }, [hasOrderedProduct, userOrders, id]);

  // Check if user has already reviewed this product
  const userReview = useMemo(() => {
    if (!currentUserId || !reviewsData.reviews) return null;
    return (
      reviewsData.reviews.find((review) => review.userId === currentUserId) ||
      null
    );
  }, [currentUserId, reviewsData.reviews]);

  // Use review stats if available, otherwise fall back to product rating
  const displayRating =
    reviewsData.ratingStats?.averageRating || product.rating || 0;
  const reviewCount = reviewsData.ratingStats?.reviewCount || 0;

  /**
   * Generate product URL for QR code
   * Uses VITE_BASE_URL for production (Vercel), falls back to window.location.origin for localhost
   * This ensures QR codes work in all environments (localhost, staging, production)
   *
   * Memoized to prevent unnecessary recalculations
   */
  const productUrl = useMemo(() => {
    // Priority: 1. VITE_BASE_URL (set in Vercel env vars), 2. window.location.origin (localhost)
    const baseUrl =
      import.meta.env.VITE_BASE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return baseUrl ? `${baseUrl}/products/${id}` : null;
  }, [id]);

  // Show error toast if API call fails
  useEffect(() => {
    if (error) {
      toast.error(error.message, {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Derived directly from cartList on every render — no need to mirror it into
  // state via an effect, this value never diverges from its source.
  const inCart = cartList.some((item) => item.id === product.id);

  // Handle review form submission
  const handleReviewSubmit = useCallback(
    (reviewData: { rating: number; comment: string }) => {
      if (editingReview) {
        // Update existing review
        updateReviewMutation.mutate(
          {
            reviewId: editingReview.id,
            updates: reviewData,
            productId: editingReview.productId || id, // Pass productId for cache invalidation
          },
          {
            onSuccess: () => {
              setEditingReview(null);
              setShowReviewForm(false);
            },
          },
        );
      } else {
        // Create new review
        createReviewMutation.mutate(
          {
            productId: id as string,
            orderId: orderIdForReview as string,
            ...reviewData,
          },
          {
            onSuccess: () => {
              setShowReviewForm(false);
            },
          },
        );
      }
    },
    [
      editingReview,
      id,
      orderIdForReview,
      createReviewMutation,
      updateReviewMutation,
    ],
  );

  // Handle review edit
  const handleReviewEdit = useCallback((review: Review) => {
    setEditingReview(review);
    setShowReviewForm(true);
  }, []);

  // Handle review delete (opens confirmation dialog)
  const handleReviewDelete = useCallback((review: Review) => {
    setReviewToDelete(review);
    setDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (reviewToDelete) {
      deleteReviewMutation.mutate(reviewToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setReviewToDelete(null);
        },
      });
    }
  }, [reviewToDelete, deleteReviewMutation]);

  // Handle cancel review form
  const handleCancelReview = useCallback(() => {
    setShowReviewForm(false);
    setEditingReview(null);
  }, []);

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  return (
    <main>
      <section className="py-8 sm:py-10">
        {/* Title and Overview */}
        <div className="text-center mb-4">
          <h1 className="text-3xl sm:text-4xl font-medium text-gray-700 dark:text-slate-200">
            {product.name}
          </h1>
          <p className="mb-2 text-base sm:text-lg text-center text-gray-700 dark:text-slate-300 max-w-7xl mx-auto">
            {product.overview}
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-8">
            {/* Left Section - Product Image */}
            <div className="flex-shrink-0 w-full lg:w-auto lg:max-w-xl">
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 h-full flex items-center justify-center">
                {product.coverColor ? (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 py-8 dark:from-slate-800 dark:to-slate-950">
                    <div className="aspect-[143/199] h-full max-h-[30rem] drop-shadow-[0_24px_28px_rgba(0,0,0,0.3)]">
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
                    className="w-full h-full rounded-lg object-cover"
                    src={getProductImageUrl(product) || product.poster || undefined}
                    key={getProductImageKey(product)}
                    alt={product.name}
                  />
                )}
              </div>

              {/* Book trailer — only rendered when the product has a videoUrl */}
              <ProductVideo videoUrl={product.videoUrl} className="mt-4" />
            </div>

            {/* Right Section - Product Details Card */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Flex Layout: QR Code on top right parallel to price/rating/badges/add button */}
              <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6 mb-4">
                {/* Product Details (Price, Rating, Badges, Add to Cart) - Wrapped in inner div */}
                <div className="flex-1 min-w-0 space-y-2 sm:space-y-2">
                  {/* Price Badge */}
                  <div>
                    <span className="inline-flex items-center px-4 py-2 rounded-lg text-2xl sm:text-3xl font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
                      <DollarSign className="h-5 w-5 mr-1.5" strokeWidth={2} />
                      {product.price?.toFixed(2) || "0.00"}
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center flex-shrink-0">
                      <Rating rating={displayRating} />
                    </div>
                    <div className="text-sm text-gray-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1">
                      <span>({displayRating.toFixed(1)} out of 5)</span>
                      {reviewCount > 0 && (
                        <>
                          <span className="hidden sm:inline"> · </span>
                          <span>
                            {reviewCount}{" "}
                            {reviewCount === 1 ? "review" : "reviews"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Product Badges */}
                  <div className="flex flex-wrap gap-2">
                    {product.best_seller && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <Star className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} fill="currentColor" />
                        Best Seller
                      </span>
                    )}
                    {/* Stock Quantity Badge - Show detailed stock info if available */}
                    {product.stock !== undefined ? (
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                          product.stock === 0
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
                            : product.stock! <= (product.lowStockThreshold || 10)
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        }`}
                      >
                        {(() => {
                          const isOut = product.stock === 0;
                          const isLow = !isOut && product.stock! <= (product.lowStockThreshold || 10);
                          const StockIcon = isOut ? XCircle : isLow ? AlertTriangle : CheckCircle2;
                          return <StockIcon className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />;
                        })()}
                        {product.stock === 0
                          ? "Out of Stock"
                          : product.stock! <= (product.lowStockThreshold || 10)
                            ? `Low Stock (${product.stock} left)`
                            : `${product.stock} in stock`}
                      </span>
                    ) : // Fallback to in_stock boolean if stock quantity not available
                    product.in_stock ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                        In Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <XCircle className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                        Out of Stock
                      </span>
                    )}
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

                  {/* Author */}
                  {product.author && (
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      <User className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" strokeWidth={2} />
                      By{" "}
                      <span className="font-medium text-gray-700 dark:text-slate-300">
                        {product.author}
                      </span>
                    </p>
                  )}

                  {/* Book Details (REQ-1616: catalog metadata) */}
                  {(product.isbn || product.publisher || product.publishedYear || product.edition || product.language || product.fileFormat || (product.tags?.length ?? 0) > 0) && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-3">Book Details</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {product.publisher && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Building2 className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">Publisher</dt>
                            <dd>{product.publisher}</dd>
                          </div>
                        )}
                        {product.publishedYear && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Calendar className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">Published</dt>
                            <dd>Published {product.publishedYear}</dd>
                          </div>
                        )}
                        {product.edition && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Layers className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">Edition</dt>
                            <dd>{product.edition}</dd>
                          </div>
                        )}
                        {product.language && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Globe className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">Language</dt>
                            <dd>{product.language}</dd>
                          </div>
                        )}
                        {product.fileFormat && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <FileText className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">Format</dt>
                            <dd>{product.fileFormat}</dd>
                          </div>
                        )}
                        {product.isbn && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Barcode className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">ISBN</dt>
                            <dd>ISBN {product.isbn}</dd>
                          </div>
                        )}
                        {product.sku && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Hash className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                            <dt className="sr-only">SKU</dt>
                            <dd>SKU {product.sku}</dd>
                          </div>
                        )}
                      </dl>
                      {(product.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <Tag className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" strokeWidth={2} />
                          {(product.tags || []).map((tag) => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add to Cart Button */}
                  <div className="py-2">
                    {!inCart ? (
                      <button
                        onClick={() => {
                          // Prevent adding out-of-stock items
                          if (!product.in_stock) {
                            return;
                          }
                          addToCart(product);
                        }}
                        disabled={!product.in_stock}
                        className={`inline-flex items-center justify-center py-3 px-6 text-base sm:text-lg font-medium text-center text-white rounded-lg transition-colors ${
                          product.in_stock
                            ? "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" strokeWidth={2} />
                        Add To Cart
                      </button>
                    ) : (
                      <button
                        onClick={() => removeFromCart(product)}
                        className={`inline-flex items-center justify-center py-3 px-6 text-base sm:text-lg font-medium text-center text-white rounded-lg transition-colors ${
                          product.in_stock
                            ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                        disabled={!product.in_stock}
                      >
                        <Trash2 className="h-4 w-4 mr-2" strokeWidth={2} />
                        Remove From Cart
                      </button>
                    )}
                  </div>
                </div>

                {/* QR Code Card - Top Right (beside product details) */}
                {(product.qrCode || productUrl) && (
                  <div className="flex-shrink-0 w-full lg:w-auto lg:max-w-[200px]">
                    <ProductQRCode
                      qrCode={product.qrCode}
                      productUrl={productUrl}
                      productName={product.name}
                      productId={product.id}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-1 sm:pt-1 mt-4"></div>

              {/* Product Description */}
              <div>
                <h2 className="text-xl sm:text-2xl font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Description
                </h2>
                <p className="text-base sm:text-lg text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line text-justify">
                  {product.long_description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations — auto-scrolling reel, pauses on hover, manual chevrons */}
        {recommendedProducts && recommendedProducts.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl sm:text-2xl font-medium text-gray-700 dark:text-slate-200">
              You Might Also Like
            </h2>
            <ProductReel products={recommendedProducts} />
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-8">
          <Card className="p-4 sm:p-6 lg:p-8">
            {/* Review Form (if user has ordered and not already reviewed, or editing) */}
            {currentUserId &&
              hasOrderedProduct &&
              !userReview &&
              !showReviewForm && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
                  >
                    <Star className="h-4 w-4 mr-2" strokeWidth={2} />
                    Write a Review
                  </button>
                </div>
              )}

            {(showReviewForm || editingReview) && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-700 dark:text-slate-200 mb-4">
                  {editingReview ? "Edit Your Review" : "Write a Review"}
                </h3>
                <ReviewForm
                  onSubmit={handleReviewSubmit}
                  onCancel={handleCancelReview}
                  initialData={editingReview}
                  isSubmitting={
                    createReviewMutation.isPending ||
                    updateReviewMutation.isPending
                  }
                />
              </div>
            )}

            {/* Reviews List */}
            {reviewsLoading ? (
              <ReviewListSkeleton />
            ) : (
              <ReviewList
                reviews={reviewsData.reviews || []}
                isLoading={reviewsLoading}
                onEdit={handleReviewEdit}
                onDelete={handleReviewDelete}
                currentUserId={currentUserId || undefined}
              />
            )}
          </Card>
        </div>

        {/* Delete Review Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Review</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this review? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setReviewToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleteReviewMutation.isPending}
                className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              >
                {deleteReviewMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </main>
  );
};
