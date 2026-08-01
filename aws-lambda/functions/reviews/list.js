/**
 * AWS Lambda - Get Reviews by Product ID
 * GET /reviews?productId=xxx
 *
 * Returns all approved reviews for a specific product.
 * Public endpoint - no authentication required.
 */

const { createResponse } = require("../../shared/response");
const { getReviewsByProductId, getProductRatingStats } = require("../../shared/reviews");

exports.handler = async (event) => {
  try {
    console.log("ReviewsListFunction - Event received:", JSON.stringify(event, null, 2));
    
    // Get productId from query parameters
    const productId = event.queryStringParameters?.productId;
    console.log("ReviewsListFunction - productId:", productId);

    if (!productId) {
      console.error("ReviewsListFunction - Missing productId parameter");
      return createResponse(400, {
        error: "productId query parameter is required",
      });
    }

    console.log("ReviewsListFunction - Fetching reviews for productId:", productId);
    // Get reviews for the product (only approved reviews)
    const reviews = await getReviewsByProductId(productId, "approved");
    console.log("ReviewsListFunction - Reviews fetched:", reviews.length);

    console.log("ReviewsListFunction - Calculating rating stats");
    // Get rating statistics
    const ratingStats = await getProductRatingStats(productId);
    console.log("ReviewsListFunction - Rating stats:", ratingStats);

    // Sort reviews by createdAt (newest first)
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("ReviewsListFunction - Returning success response");
    return createResponse(200, {
      reviews,
      ratingStats,
    });
  } catch (error) {
    console.error("❌ ReviewsListFunction - Error fetching reviews:", error);
    console.error("❌ ReviewsListFunction - Error name:", error.name);
    console.error("❌ ReviewsListFunction - Error message:", error.message);
    console.error("❌ ReviewsListFunction - Error stack:", error.stack);
    
    // Return detailed error message for debugging
    const errorMessage = error.message || "Unknown error occurred";
    const errorName = error.name || "Error";
    
    return createResponse(500, {
      error: "Failed to fetch reviews",
      message: errorMessage,
      errorType: errorName,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

