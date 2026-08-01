import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Star, XCircle, AlertTriangle, CheckCircle2, FileText, BookOpen, User, ShoppingCart, Trash2, Barcode, Hash, Building2, Calendar, Layers, Globe, Tag, BarChart3, type LucideIcon } from "lucide-react";
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

// Info-grid row — one line of the "Book Details" panel. Keeps the panel a
// tidy, scannable list instead of the old wall-of-colored-pills layout.
const DetailRow = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) => (
  <div className="flex items-center gap-2.5 text-sm">
    <Icon className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={2} />
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="ml-auto font-medium text-gray-700 dark:text-gray-200">{value}</span>
  </div>
);

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

  const isOut = product.stock === 0 || (product.stock == null && !product.in_stock);
  const isLow = !isOut && product.stock != null && product.stock <= (product.lowStockThreshold || 10);
  const StockIcon = isOut ? XCircle : isLow ? AlertTriangle : CheckCircle2;
  const stockLabel = isOut
    ? "Out of Stock"
    : product.stock != null
      ? isLow
        ? `Low stock — only ${product.stock} left`
        : `${product.stock} in stock`
      : "In Stock";
  const stockColorClass = isOut
    ? "text-rose-700 dark:text-rose-400"
    : isLow
      ? "text-amber-700 dark:text-amber-400"
      : "text-emerald-700 dark:text-emerald-400";

  const hasBookDetails = Boolean(
    product.publisher || product.publishedYear || product.edition || product.language || product.fileFormat || product.isbn || product.sku || product.pages || product.category || product.level,
  );

  return (
    <main>
      <section className="py-6 sm:py-10">
        {/* Hero: cover art + purchase panel, side by side, no heavy outer card */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left — cover, trailer, QR (secondary/utility, not competing with Buy) */}
          <div className="mx-auto w-full max-w-xs flex-shrink-0 lg:mx-0 lg:w-72">
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900">
              {product.coverColor ? (
                <div className="flex w-full items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 py-8 dark:from-slate-800 dark:to-slate-950">
                  <div className="aspect-[143/199] w-40 drop-shadow-[0_24px_28px_rgba(0,0,0,0.3)] sm:w-48">
                    <BookCover variant="fill" coverColor={product.coverColor} coverImage={getProductImageUrl(product) || product.poster} alt={product.name} />
                  </div>
                </div>
              ) : (
                <img
                  className="aspect-[143/199] w-full rounded-xl object-cover"
                  src={getProductImageUrl(product) || product.poster || undefined}
                  key={getProductImageKey(product)}
                  alt={product.name}
                />
              )}
            </div>

            <ProductVideo videoUrl={product.videoUrl} className="mt-4" />

            {(product.qrCode || productUrl) && (
              <details className="group mt-4 rounded-lg border border-gray-200 dark:border-slate-700">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 [&::-webkit-details-marker]:hidden">
                  Share via QR code
                </summary>
                <div className="border-t border-gray-200 p-4 dark:border-slate-700">
                  <ProductQRCode qrCode={product.qrCode} productUrl={productUrl} productName={product.name} productId={product.id} className="w-full" />
                </div>
              </details>
            )}
          </div>

          {/* Right — everything the shopper needs to decide + buy */}
          <div className="min-w-0 flex-1">
            {product.category && (
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{product.category}</span>
            )}
            <h1 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white sm:text-3xl">{product.name}</h1>
            {product.author && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                <User className="-mt-0.5 mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
                by <span className="font-medium text-gray-700 dark:text-gray-300">{product.author}</span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Rating rating={displayRating} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {displayRating.toFixed(1)}
                {reviewCount > 0 ? ` · ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` : ""}
              </span>
              {product.best_seller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Star className="h-3 w-3" strokeWidth={2} fill="currentColor" />
                  Best Seller
                </span>
              )}
            </div>

            {product.overview && <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">{product.overview}</p>}

            <div className="mt-6 flex items-end gap-4">
              <span className="text-3xl font-bold text-gray-800 dark:text-white sm:text-4xl">${product.price?.toFixed(2) || "0.00"}</span>
              <span className={`mb-1 flex items-center gap-1.5 text-sm font-medium ${stockColorClass}`}>
                <StockIcon className="h-4 w-4" strokeWidth={2} />
                {stockLabel}
              </span>
            </div>

            <div className="mt-4">
              {!inCart ? (
                <button
                  onClick={() => {
                    // Prevent adding out-of-stock items
                    if (!product.in_stock) return;
                    addToCart(product);
                  }}
                  disabled={!product.in_stock}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-medium text-white transition-colors sm:w-auto ${
                    product.in_stock ? "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700" : "cursor-not-allowed bg-gray-400"
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" strokeWidth={2} />
                  Add To Cart
                </button>
              ) : (
                <button
                  onClick={() => removeFromCart(product)}
                  disabled={!product.in_stock}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-medium text-white transition-colors sm:w-auto ${
                    product.in_stock ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800" : "cursor-not-allowed bg-gray-400"
                  }`}
                >
                  <Trash2 className="h-5 w-5" strokeWidth={2} />
                  Remove From Cart
                </button>
              )}
            </div>

            {/* Book Details — a tidy scannable grid instead of a wall of colored pills */}
            {hasBookDetails && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-white">Book Details</h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {product.publisher && <DetailRow icon={Building2} label="Publisher" value={product.publisher} />}
                  {product.publishedYear && <DetailRow icon={Calendar} label="Published" value={product.publishedYear} />}
                  {product.edition && <DetailRow icon={Layers} label="Edition" value={product.edition} />}
                  {product.language && <DetailRow icon={Globe} label="Language" value={product.language} />}
                  {product.fileFormat && <DetailRow icon={FileText} label="Format" value={product.fileFormat} />}
                  {product.pages && <DetailRow icon={BookOpen} label="Pages" value={product.pages} />}
                  {product.level && <DetailRow icon={BarChart3} label="Level" value={product.level} />}
                  {product.isbn && <DetailRow icon={Barcode} label="ISBN" value={product.isbn} />}
                  {product.sku && <DetailRow icon={Hash} label="SKU" value={product.sku} />}
                  {product.size && <DetailRow icon={FileText} label="Size" value={`${product.size} MB`} />}
                </div>
                {(product.tags?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <Tag className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" strokeWidth={2} />
                    {(product.tags || []).map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description — its own full-width section, separated from the hero */}
        {product.long_description && (
          <Card className="mt-8 p-4 sm:p-6 lg:p-8">
            <h2 className="mb-3 text-xl font-semibold text-gray-800 dark:text-white">Description</h2>
            <p className="whitespace-pre-line text-base leading-relaxed text-gray-600 dark:text-slate-300">{product.long_description}</p>
          </Card>
        )}

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
