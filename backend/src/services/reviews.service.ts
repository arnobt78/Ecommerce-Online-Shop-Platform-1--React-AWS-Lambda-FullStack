// Parent: REQ-1202, REQ-1205, REQ-1301, REQ-1304
// Ported from aws-lambda/shared/reviews.js — same function contracts.

import { z } from "zod";
import type { Review } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Parent: REQ-1304 — validated at the POST /reviews route boundary.
export const createReviewSchema = z.object({
  productId: z.string().min(1),
  userId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.coerce.number(),
  comment: z.string().min(1),
  userName: z.string().optional(),
  userEmail: z.string().optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  rating: z.coerce.number().optional(),
  comment: z.string().optional(),
  status: z.string().optional(),
  adminReply: z.string().nullable().optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export async function createReview({
  productId,
  userId,
  orderId,
  rating,
  comment,
  userName,
  userEmail,
}: CreateReviewInput): Promise<Review> {
  if (!productId || !userId || !orderId || !rating || !comment) {
    throw new Error("Missing required fields: productId, userId, orderId, rating, comment");
  }

  const ratingNum = Number(rating);
  if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new Error("Rating must be a number between 1 and 5");
  }

  const existing = await getReviewsByProductAndUser(productId, userId);
  if (existing.length > 0) {
    throw new Error("You have already reviewed this product");
  }

  return prisma.review.create({
    data: {
      productId,
      userId,
      orderId,
      rating: ratingNum,
      comment: comment.trim(),
      userName: userName || "Customer",
      userEmail: userEmail || "",
      status: "approved",
    },
  });
}

export async function getReviewById(reviewId: string): Promise<Review | null> {
  return prisma.review.findUnique({ where: { id: reviewId } });
}

export async function getReviewsByProductId(productId: string, status: string | null = "approved"): Promise<Review[]> {
  return prisma.review.findMany({
    where: { productId, ...(status && { status }) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReviewsByUserId(userId: string): Promise<Review[]> {
  return prisma.review.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getReviewsByProductAndUser(productId: string, userId: string): Promise<Review[]> {
  return prisma.review.findMany({ where: { productId, userId } });
}

export async function getAllReviews(status: string | null = null): Promise<Review[]> {
  return prisma.review.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

const VALID_REVIEW_STATUSES = ["approved", "pending", "rejected"] as const;

export async function updateReview(reviewId: string, updates: UpdateReviewInput): Promise<Review> {
  const data: Record<string, unknown> = {};

  if (updates.rating !== undefined) {
    const ratingNum = Number(updates.rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw new Error("Rating must be a number between 1 and 5");
    }
    data.rating = ratingNum;
  }

  if (updates.comment !== undefined) data.comment = updates.comment.trim();

  if (updates.status !== undefined) {
    if (!(VALID_REVIEW_STATUSES as readonly string[]).includes(updates.status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_REVIEW_STATUSES.join(", ")}`);
    }
    data.status = updates.status;
  }

  if (updates.adminReply !== undefined) {
    const trimmed = updates.adminReply?.trim() || null;
    data.adminReply = trimmed;
    data.adminReplyAt = trimmed ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields to update");
  }

  return prisma.review.update({ where: { id: reviewId }, data });
}

export async function deleteReview(reviewId: string): Promise<true> {
  await prisma.review.delete({ where: { id: reviewId } });
  return true;
}

export interface ProductRatingStats {
  averageRating: number;
  reviewCount: number;
}

export async function getProductRatingStats(productId: string): Promise<ProductRatingStats> {
  const reviews = await getReviewsByProductId(productId, "approved");
  if (reviews.length === 0) return { averageRating: 0, reviewCount: 0 };

  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  return {
    averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
  };
}
