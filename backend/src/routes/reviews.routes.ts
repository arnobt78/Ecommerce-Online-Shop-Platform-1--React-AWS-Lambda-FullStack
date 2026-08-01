// Parent: REQ-1200, REQ-1301, REQ-1304 — parity with aws-lambda/functions/reviews/*.js and
// aws-lambda/functions/admin/{reviews,review-update}.js

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import * as reviewsService from "../services/reviews.service";
import { createReviewSchema } from "../services/reviews.service";
import { getOrderById } from "../services/orders.service";
import { logActivity } from "../services/activityLog.service";
import { analyzeReviewSentiment, AiInsightsUnavailableError } from "../services/aiInsights.service";

export const publicRouter = express.Router();
export const adminRouter = express.Router();

// GET /reviews?productId=xxx — public
publicRouter.get("/reviews", async (req: Request, res: Response) => {
  try {
    const { productId } = req.query;
    if (!productId) return errorResponse(res, "productId query parameter is required", 400);

    const reviews = await reviewsService.getReviewsByProductId(String(productId), "approved");
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const ratingStats = await reviewsService.getProductRatingStats(String(productId));

    return successResponse(res, { reviews, ratingStats });
  } catch (error) {
    console.error("Reviews list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /reviews — requires the user to have actually ordered the product.
publicRouter.post("/reviews", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createReviewSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) {
      return errorResponse(res, "Missing required fields: productId, orderId, rating, comment", 400);
    }
    const { productId, orderId, rating, comment } = parsed.data;

    const order = await getOrderById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);
    if (order.userId !== req.user!.id) {
      return errorResponse(res, "You can only review products from your own orders", 403);
    }
    const cartList = order.cartList as Array<{ id?: string }>;
    const productInOrder = cartList?.some((item) => item.id === productId);
    if (!productInOrder) {
      return errorResponse(res, "This product is not in the specified order", 400);
    }

    const orderUser = order.user as { name?: string; email?: string } | null;
    const review = await reviewsService.createReview({
      productId,
      userId: req.user!.id,
      orderId,
      rating,
      comment,
      userName: req.user!.name || orderUser?.name || "Customer",
      userEmail: req.user!.email || orderUser?.email || "",
    });

    return successResponse(res, { message: "Review created successfully", review }, 201);
  } catch (error) {
    console.error("Review create error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /reviews/:id — owner or admin only; only rating/comment (not status).
publicRouter.put("/reviews/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const existingReview = await reviewsService.getReviewById(req.params.id!);
    if (!existingReview) return errorResponse(res, "Review not found", 404);
    if (req.user!.role !== "admin" && existingReview.userId !== req.user!.id) {
      return errorResponse(res, "You can only update your own reviews", 403);
    }

    const updates: { rating?: number; comment?: string } = {};
    if (req.body?.rating !== undefined) updates.rating = req.body.rating;
    if (req.body?.comment !== undefined) updates.comment = req.body.comment;
    if (Object.keys(updates).length === 0) return errorResponse(res, "No valid fields to update", 400);

    const review = await reviewsService.updateReview(req.params.id!, updates);
    return successResponse(res, { message: "Review updated successfully", review });
  } catch (error) {
    console.error("Review update error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// DELETE /reviews/:id — owner or admin only.
publicRouter.delete("/reviews/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const existingReview = await reviewsService.getReviewById(req.params.id!);
    if (!existingReview) return errorResponse(res, "Review not found", 404);
    if (req.user!.role !== "admin" && existingReview.userId !== req.user!.id) {
      return errorResponse(res, "You can only delete your own reviews", 403);
    }

    const productId = existingReview.productId;
    await reviewsService.deleteReview(req.params.id!);
    return successResponse(res, { message: "Review deleted successfully", productId });
  } catch (error) {
    console.error("Review delete error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /admin/reviews — moderation queue
adminRouter.get("/admin/reviews", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const reviews = await reviewsService.getAllReviews();
    return successResponse(res, reviews);
  } catch (error) {
    console.error("Admin reviews list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /admin/reviews/:id — REQ-1619: single-review detail page
adminRouter.get("/admin/reviews/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const review = await reviewsService.getReviewById(req.params.id!);
    if (!review) return errorResponse(res, "Review not found", 404);
    return successResponse(res, review);
  } catch (error) {
    console.error("Admin review detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /admin/reviews/:id/analyze-sentiment — REQ-1651: on-demand AI sentiment/
// moderation-flag check, run per admin click (not automatically on every
// review) to keep it opt-in and avoid adding LLM latency/cost to review
// creation. Analyzes the review's real persisted text, not client-supplied text.
adminRouter.post("/admin/reviews/:id/analyze-sentiment", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const review = await reviewsService.getReviewById(req.params.id!);
    if (!review) return errorResponse(res, "Review not found", 404);

    const result = await analyzeReviewSentiment(review.rating, review.comment);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof AiInsightsUnavailableError) {
      return errorResponse(res, { message: error.message, code: error.code }, 503);
    }
    console.error("Review sentiment analysis error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /admin/reviews/:id — status and/or adminReply (public store response)
adminRouter.put("/admin/reviews/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const existingReview = await reviewsService.getReviewById(req.params.id!);
    if (!existingReview) return errorResponse(res, "Review not found", 404);

    const updates: { status?: string; adminReply?: string | null } = {};
    if (req.body?.status !== undefined) updates.status = req.body.status;
    if (req.body?.adminReply !== undefined) updates.adminReply = req.body.adminReply;
    if (Object.keys(updates).length === 0) return errorResponse(res, "No valid fields to update", 400);

    const review = await reviewsService.updateReview(req.params.id!, updates);

    if (updates.adminReply !== undefined) {
      logActivity({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        action: "update",
        entityType: "review",
        entityId: req.params.id!,
        details: { action: "admin_reply", productId: review.productId, hasReply: !!review.adminReply },
      });
    }

    return successResponse(res, { message: "Review updated successfully", review });
  } catch (error) {
    console.error("Admin review update error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
