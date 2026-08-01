/**
 * AWS Lambda - Update Review
 * PUT /reviews/:id
 *
 * Updates an existing review.
 * Requires authentication - user can update their own review, admin can update any review.
 */

const { createResponse } = require("../../shared/response");
const { verifyAuth } = require("../../shared/auth");
const { getReviewById, updateReview } = require("../../shared/reviews");

exports.handler = async (event) => {
  try {
    // Verify authentication
    const authResult = verifyAuth(event);
    if (!authResult.valid) {
      return createResponse(401, {
        error: "Unauthorized",
        message: authResult.error,
      });
    }

    const { userId, role: userRole } = authResult;

    // Get review ID from path parameters
    const reviewId = event.pathParameters?.id;
    if (!reviewId) {
      return createResponse(400, {
        error: "Review ID is required",
      });
    }

    // Get existing review
    const existingReview = await getReviewById(reviewId);
    if (!existingReview) {
      return createResponse(404, {
        error: "Review not found",
      });
    }

    // Check permissions: user can only update their own review, admin can update any
    if (userRole !== "admin" && existingReview.userId !== userId) {
      return createResponse(403, {
        error: "You can only update your own reviews",
      });
    }

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return createResponse(400, {
        error: "Invalid JSON in request body",
      });
    }

    // Only allow updating rating and comment (not status - that's admin only)
    const updates = {};
    if (body.rating !== undefined) {
      updates.rating = body.rating;
    }
    if (body.comment !== undefined) {
      updates.comment = body.comment;
    }

    if (Object.keys(updates).length === 0) {
      return createResponse(400, {
        error: "No valid fields to update",
      });
    }

    // Update the review
    const updatedReview = await updateReview(reviewId, updates);

    return createResponse(200, {
      message: "Review updated successfully",
      review: updatedReview,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    return createResponse(500, {
      error: "Failed to update review",
      message: error.message,
    });
  }
};

