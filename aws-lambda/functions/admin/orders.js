/**
 * AWS Lambda Function: Admin Orders
 *
 * This Lambda function handles GET requests for all orders (admin only).
 *
 * Endpoints:
 * - GET /admin/orders - Get all orders (admin only)
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * GET /admin/orders:
 * - Returns all orders in the system
 * - This endpoint is for admin panel - shows all orders regardless of user
 * - User dashboard uses /orders endpoint (user-specific)
 */

const { getAllOrders } = require("../../shared/orders");
const { requireAuth } = require("../../shared/auth");
const { successResponse, errorResponse, handleOptions } = require("../../shared/response");

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object from HTTP API
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (httpMethod !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  try {
    // Require authentication
    const user = requireAuth(event);

    // Check if user is admin
    if (user.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Get all orders (admin only)
    const orders = await getAllOrders();
    return successResponse(orders, 200);
  } catch (error) {
    console.error("Admin Orders Error:", error);

    // Handle authentication errors
    if (
      error.message?.includes("Unauthorized") ||
      error.message?.includes("Invalid token") ||
      error.message?.includes("No token")
    ) {
      return errorResponse({ message: error.message, error: "UnauthorizedError" }, 401);
    }

    // Return error response
    return errorResponse(
      {
        message: error.message || "Internal server error",
        error: error.name || "UnknownError",
        code: error.code || "NO_CODE",
      },
      500
    );
  }
};

