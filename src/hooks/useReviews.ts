/**
 * React Query hooks for review operations
 *
 * Caching Strategy:
 * - staleTime: Infinity = Data never becomes stale automatically
 * - refetchOnMount: true = Refetch ONLY when data is stale (invalidated)
 * - Result: Cache forever until manually invalidated, then refetch once
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import {
  getReviewsByProduct,
  createReview,
  updateReview,
  deleteReview,
  getAllReviews,
  updateReviewStatus,
  getReviewById,
  replyToReview,
  type RatingStats,
  type CreateReviewInput,
  type UpdateReviewInput,
} from "../services/reviewService";
import { toast } from "../lib/toast";
import type { Review } from "../types";

export function useReviewsByProduct(
  productId: string | undefined,
  enabled = true,
): UseQueryResult<{ reviews: Review[]; ratingStats: RatingStats }, Error> {
  return useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => getReviewsByProduct(productId as string),
    enabled: enabled && !!productId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

export function useCreateReview(): UseMutationResult<Review, Error, CreateReviewInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReview,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", variables.productId] });
      // Also invalidate product detail to update its rating
      queryClient.invalidateQueries({ queryKey: ["product", variables.productId] });
      // Admin moderation page reflects the new review immediately
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"], exact: false });

      toast.success("Review submitted successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit review", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface UpdateReviewVariables {
  reviewId: string;
  updates: UpdateReviewInput;
  productId?: string;
}

export function useUpdateReview(): UseMutationResult<Review, Error, UpdateReviewVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, updates }: UpdateReviewVariables) => updateReview(reviewId, updates),
    onSuccess: (data, variables) => {
      const productId = variables.productId || data.productId;

      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["reviews"], exact: false });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-reviews"], exact: false });

      toast.success("Review updated successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update review", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useDeleteReview(): UseMutationResult<{ message: string; productId: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReview,
    onSuccess: (data) => {
      const productId = data.productId;

      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["reviews"], exact: false });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-reviews"], exact: false });

      toast.success("Review deleted successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete review", { closeButton: true, position: "bottom-right" });
    },
  });
}

export function useAllReviews(status: string | null = null, enabled = true): UseQueryResult<Review[], Error> {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["admin-reviews", status],
    queryFn: () => getAllReviews(status),
    enabled: enabled && !!hasToken,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

interface UpdateReviewStatusVariables {
  reviewId: string;
  status: string;
}

export function useUpdateReviewStatus(): UseMutationResult<Review, Error, UpdateReviewStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, status }: UpdateReviewStatusVariables) => updateReviewStatus(reviewId, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"], exact: false });

      const productId = data.productId;
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["reviews"], exact: false });
      }

      toast.success("Review status updated successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update review status", { closeButton: true, position: "bottom-right" });
    },
  });
}

// Parent: REQ-1619 — single review fetch for the admin review detail page.
export function useReview(reviewId: string | undefined, enabled = true): UseQueryResult<Review, Error> {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["admin-review", reviewId],
    queryFn: () => getReviewById(reviewId as string),
    enabled: enabled && !!hasToken && !!reviewId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

interface ReplyToReviewVariables {
  reviewId: string;
  adminReply: string | null;
}

export function useReplyToReview(): UseMutationResult<Review, Error, ReplyToReviewVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, adminReply }: ReplyToReviewVariables) => replyToReview(reviewId, adminReply),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["admin-review", variables.reviewId] });

      const productId = data.productId;
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      }

      toast.success(variables.adminReply ? "Reply posted successfully!" : "Reply removed successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to post reply", { closeButton: true, position: "bottom-right" });
    },
  });
}
