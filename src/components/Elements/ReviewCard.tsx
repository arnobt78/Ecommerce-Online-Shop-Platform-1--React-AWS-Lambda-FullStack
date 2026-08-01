/**
 * ReviewCard Component
 *
 * Displays a single product review with rating, comment, and user info.
 */

import { Pencil, Trash2, CheckCircle2, Store } from "lucide-react";
import { Rating } from "./Rating";
import type { Review } from "../../types";

function formatRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return "";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffWeeks < 4)
      return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    if (diffMonths < 12)
      return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
    return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
}

interface ReviewCardProps {
  review: Review;
  showActions?: boolean;
  onEdit?: (review: Review) => void;
  onDelete?: (review: Review) => void;
  currentUserId?: string;
}

export const ReviewCard = ({
  review,
  showActions = false,
  onEdit,
  onDelete,
  currentUserId,
}: ReviewCardProps) => {
  const isOwner = currentUserId && review.userId === currentUserId;
  const canEdit = showActions && isOwner;
  const canDelete = showActions && isOwner;

  return (
    <div className="p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* User Name and Rating */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
            <h4 className="text-base sm:text-lg font-medium text-gray-700 dark:text-slate-200">
              {review.userName || "Anonymous"}
            </h4>
            <div className="flex items-center">
              <Rating rating={review.rating} />
            </div>
            {/* Every review is required to reference a real order at creation
                (see backend/src/routes/reviews.routes.ts), so this is always true. */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
              Verified Purchase
            </span>
          </div>

          {/* Comment */}
          <p className="text-sm sm:text-base text-gray-700 dark:text-slate-300 leading-relaxed mb-3 whitespace-pre-line">
            {review.comment}
          </p>

          {/* Timestamp */}
          <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-3">
            {formatRelativeTime(review.createdAt)}
          </div>

          {/* Store Response — REQ-1619 */}
          {review.adminReply && (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Store className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" strokeWidth={2} />
                <span className="text-xs font-medium text-sky-800 dark:text-sky-300">Response from CodeBook</span>
                {review.adminReplyAt && <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(review.adminReplyAt)}</span>}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{review.adminReply}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0">
            {canEdit && (
              <button
                onClick={() => onEdit && onEdit(review)}
                className="p-2 text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
                aria-label="Edit review"
              >
                <Pencil className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete && onDelete(review)}
                className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                aria-label="Delete review"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
