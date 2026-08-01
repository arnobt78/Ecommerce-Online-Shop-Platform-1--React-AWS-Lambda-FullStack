/**
 * AWS Lambda - Get All Reviews (Admin)
 * GET /admin/reviews
 *
 * Returns all reviews for admin moderation.
 * Requires admin authentication.
 */

const { createResponse } = require("../../shared/response");
const { verifyAuth } = require("../../shared/auth");
const { getAllReviews } = require("../../shared/reviews");

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

    // Get status filter from query parameters (optional)
    const status = event.queryStringParameters?.status || null;

    // Get all reviews
    const reviews = await getAllReviews(status);

    // Sort by createdAt (newest first)
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return createResponse(200, {
      reviews,
      count: reviews.length,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return createResponse(500, {
      error: "Failed to fetch reviews",
      message: error.message,
    });
  }
};

