/**
 * AWS Lambda - Delete Review
 * DELETE /reviews/:id
 *
 * Deletes a review.
 * Requires authentication - user can delete their own review, admin can delete any review.
 */

const { createResponse } = require("../../shared/response");
const { verifyAuth } = require("../../shared/auth");
const { getReviewById, deleteReview } = require("../../shared/reviews");

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

    // Check permissions: user can only delete their own review, admin can delete any
    if (userRole !== "admin" && existingReview.userId !== userId) {
      return createResponse(403, {
        error: "You can only delete your own reviews",
      });
    }

    // Store productId before deletion for cache invalidation
    const productId = existingReview.productId;

    // Delete the review
    await deleteReview(reviewId);

    return createResponse(200, {
      message: "Review deleted successfully",
      productId, // Return productId for cache invalidation
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return createResponse(500, {
      error: "Failed to delete review",
      message: error.message,
    });
  }
};

