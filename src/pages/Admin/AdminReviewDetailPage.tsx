/**
 * AdminReviewDetailPage Component (REQ-1619)
 *
 * Single-review detail page for admin: full comment, status moderation,
 * and a public "store response" (adminReply) — the admin equivalent of the
 * per-entity detail pages every other admin list (Products, Orders, Users,
 * Tickets) already has.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useReview, useUpdateReviewStatus, useReplyToReview } from "../../hooks/useReviews";
import { useAllProducts } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { PageHeader, LoadingState, ErrorState, Card, FormSelect, FormTextarea, FormLabel, RippleButton } from "../../components/ui";
import { Rating } from "../../components/Elements/Rating";
import { formatDateLong } from "../../utils/formatDate";

const STATUS_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const AdminReviewDetailContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { id: reviewId } = useParams();
  const navigate = useNavigate();
  const { data: review, isLoading, error } = useReview(reviewId);
  const { data: allProducts = [] } = useAllProducts();
  const updateStatusMutation = useUpdateReviewStatus();
  const replyMutation = useReplyToReview();

  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (review) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding editable textarea from an async fetch
      setReplyText(review.adminReply || "");
    }
  }, [review]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load review", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  const product = allProducts.find((p) => p.id === review?.productId);

  const handleReplySubmit = () => {
    if (!reviewId) return;
    replyMutation.mutate({ reviewId, adminReply: replyText.trim() || null });
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader title="Review Details" description="Moderate and respond to a customer review" onToggleSidebar={toggleSidebar} showBackButton={true} onBack={() => navigate("/admin/reviews")} />

      {isLoading && <LoadingState message="Loading review..." />}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load review"} />}

      {!isLoading && !error && review && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <Rating rating={review.rating} />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{review.rating}/5</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                    Verified Purchase
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{review.comment}</p>
              </div>
              <div className="w-full sm:w-48">
                <FormLabel htmlFor="status">Moderation Status</FormLabel>
                <FormSelect id="status" value={review.status} onChange={(e) => updateStatusMutation.mutate({ reviewId: review.id, status: e.target.value })} options={STATUS_OPTIONS} disabled={updateStatusMutation.isPending} />
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Reviewer</dt>
                <dd className="text-sm">
                  <Link to={`/admin/users/${review.userId}`} className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline">
                    {review.userName || "Anonymous"}
                  </Link>
                  <span className="block text-gray-500 dark:text-gray-400">{review.userEmail}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Product</dt>
                <dd className="text-sm">
                  <Link to={`/admin/products/${review.productId}`} className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline">
                    {product?.name || `${review.productId.slice(0, 8)}...`}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Order</dt>
                <dd className="text-sm">
                  <Link to={`/admin/orders/${review.orderId}`} className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline font-mono">
                    {review.orderId.slice(0, 8)}...
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted</dt>
                <dd className="text-sm text-gray-700 dark:text-white">{formatDateLong(review.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
              <h2 className="text-lg font-medium text-gray-700 dark:text-white">Store Response</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Publicly visible under this review on the product page. Leave blank and save to remove an existing response.</p>
            <FormTextarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Thank the customer or address their feedback..." rows={4} disabled={replyMutation.isPending} />
            <div className="mt-3 flex justify-end">
              <RippleButton
                onClick={handleReplySubmit}
                disabled={replyMutation.isPending || replyText.trim() === (review.adminReply || "")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {replyMutation.isPending ? "Saving..." : review.adminReply ? "Update Response" : "Post Response"}
              </RippleButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export const AdminReviewDetailPage = () => {
  useTitle("Admin Review Details");
  const navigate = useNavigate();

  useEffect(() => {
    const userRole = sessionStorage.getItem("userRole");
    if (userRole !== "admin") {
      toast.error("Admin access required", { closeButton: true, position: "bottom-right" });
      navigate("/products");
    }
  }, [navigate]);

  return (
    <AdminLayout>
      <AdminReviewDetailContent />
    </AdminLayout>
  );
};
