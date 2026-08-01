/**
 * ReviewForm Component
 *
 * Form for creating or editing a product review.
 */

import { useState, useCallback } from "react";
import type { FormEvent } from "react";
import { Star } from "lucide-react";
import { FormTextarea } from "../ui/form-textarea";
import { FormError } from "../ui/form-error";
import { RippleButton } from "../ui/ripple-button";
import type { Review } from "../../types";

interface ReviewFormErrors {
  rating?: string | null;
  comment?: string | null;
}

interface ReviewFormInitialData {
  rating?: number;
  comment?: string;
}

interface ReviewFormProps {
  onSubmit: (data: { rating: number; comment: string }) => void;
  onCancel?: () => void;
  initialData?: ReviewFormInitialData | Review | null;
  isSubmitting?: boolean;
}

export const ReviewForm = ({
  onSubmit,
  onCancel,
  initialData = null,
  isSubmitting = false,
}: ReviewFormProps) => {
  const [rating, setRating] = useState(initialData?.rating || 0);
  const [comment, setComment] = useState(initialData?.comment || "");
  const [errors, setErrors] = useState<ReviewFormErrors>({});

  const handleRatingClick = useCallback((selectedRating: number) => {
    setRating(selectedRating);
    setErrors((prev) => ({ ...prev, rating: null }));
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Validation
      const newErrors: ReviewFormErrors = {};
      if (rating < 1 || rating > 5) {
        newErrors.rating = "Please select a rating";
      }
      if (!comment.trim()) {
        newErrors.comment = "Please enter a review comment";
      }
      if (comment.trim().length < 10) {
        newErrors.comment = "Review comment must be at least 10 characters";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      onSubmit({ rating, comment: comment.trim() });
    },
    [rating, comment, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Rating <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingClick(star)}
              disabled={isSubmitting}
              className={`transition-transform hover:scale-110 ${
                isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              <Star
                className={`h-6 w-6 ${star <= rating ? "text-yellow-500" : "text-gray-300 dark:text-gray-600"}`}
                strokeWidth={2}
                fill={star <= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm text-gray-600 dark:text-slate-400 ml-2">
              {rating} out of 5
            </span>
          )}
        </div>
        {errors.rating && <FormError message={errors.rating} />}
      </div>

      {/* Comment */}
      <div>
        <FormTextarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setErrors((prev) => ({ ...prev, comment: null }));
          }}
          placeholder="Share your experience with this product..."
          rows={5}
          required
          disabled={isSubmitting}
        />
        {errors.comment && <FormError message={errors.comment} />}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <RippleButton
          type="submit"
          disabled={isSubmitting}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          }`}
        >
          {isSubmitting ? "Submitting..." : initialData ? "Update Review" : "Submit Review"}
        </RippleButton>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

