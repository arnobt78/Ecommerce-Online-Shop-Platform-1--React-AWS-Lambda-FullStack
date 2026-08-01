/**
 * AWS Lambda Function: Admin - Get Order by ID
 *
 * This Lambda function handles GET requests to fetch a single order by ID (admin only).
 *
 * Endpoint: GET /admin/orders/{id}
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Response:
 * {
 *   "id": "...",
 *   "userId": "...",
 *   "cartList": [...],
 *   "amount_paid": 100,
 *   "quantity": 5,
 *   "status": "pending",
 *   "user": { "id": "...", "name": "...", "email": "..." },
 *   "createdAt": "2025-12-02T...",
 *   ...
 * }
 */

const { getOrderById } = require("../../shared/orders");
const { requireAuth } = require("../../shared/auth");
const {
  successResponse,
  errorResponse,
  handleOptions,
} = require("../../shared/response");

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object from HTTP API
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  // Log the incoming request for debugging
  console.log("Admin Order Detail Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow GET method
  if (httpMethod !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  try {
    // Require authentication
    const decoded = requireAuth(event);

    // Check if user is admin - get role from JWT token (no DynamoDB call needed)
    // Role is included in JWT token to optimize performance and reduce RCU usage
    if (decoded.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Extract order ID from path parameters
    const orderId = event.pathParameters?.id;
    if (!orderId) {
      return errorResponse("Order ID is required in path", 400);
    }

    // Get order by ID (uses GetCommand - most efficient)
    const order = await getOrderById(orderId);

    if (!order) {
      return errorResponse("Order not found", 404);
    }

    // Return success response
    return successResponse(order, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Admin Order Detail Error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    });

    // Handle authentication errors
    if (
      error.message === "No token provided" ||
      error.message === "Invalid token"
    ) {
      return errorResponse("Unauthorized", 401);
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

