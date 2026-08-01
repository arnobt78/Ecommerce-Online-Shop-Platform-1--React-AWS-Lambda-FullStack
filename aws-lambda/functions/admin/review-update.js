/**
 * AWS Lambda - Update Review Status (Admin)
 * PUT /admin/reviews/:id
 *
 * Updates review status (approve/reject) for moderation.
 * Requires admin authentication.
 */

const { createResponse } = require("../../shared/response");
const { verifyAuth } = require("../../shared/auth");
const { getReviewById, updateReview } = require("../../shared/reviews");

exports.handler = async (event) => {
  try {
    // Verify authentication and admin role
    const authResult = verifyAuth(event);
    if (!authResult.valid) {
      return createResponse(401, {
        error: "Unauthorized",
        message: authResult.error,
      });
    }

    if (authResult.role !== "admin") {
      return createResponse(403, {
        error: "Forbidden",
        message: "Admin access required",
      });
    }

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

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return createResponse(400, {
        error: "Invalid JSON in request body",
      });
    }

    // Only allow updating status (admin moderation)
    const updates = {};
    if (body.status !== undefined) {
      updates.status = body.status;
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

