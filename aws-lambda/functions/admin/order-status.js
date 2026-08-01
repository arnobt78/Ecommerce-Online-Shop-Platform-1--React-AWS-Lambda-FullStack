/**
 * AWS Lambda Function: Admin - Update Order Status
 *
 * This Lambda function handles PUT requests to update order status (admin only).
 *
 * Endpoint: PUT /admin/orders/{id}/status
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Request Body:
 * {
 *   "status": "processing" // pending, processing, shipped, delivered, cancelled
 * }
 *
 * Response:
 * {
 *   "id": "...",
 *   "status": "processing",
 *   "updatedAt": "2025-12-02T...",
 *   ...
 * }
 */

const { updateOrderStatus, getOrderById } = require("../../shared/orders");
const { requireAuth } = require("../../shared/auth");
const { logActivity } = require("../../shared/activityLog");
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
  console.log("Admin Order Status Update Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow PUT method
  if (httpMethod !== "PUT") {
    return errorResponse("Method not allowed. Use PUT.", 405);
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

    // Parse request body
    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate status field
    const { status } = body;
    if (!status) {
      return errorResponse("Status is required in request body", 400);
    }

    // Get existing order to check previous status
    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) {
      return errorResponse("Order not found", 404);
    }

    // Update order status
    const updatedOrder = await updateOrderStatus(orderId, status);

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: decoded.id,
      userEmail: decoded.email,
      userName: decoded.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: existingOrder.status,
        newStatus: status,
        orderId: orderId,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    return successResponse(updatedOrder, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Admin Order Status Update Error:", {
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

    // Handle not found errors
    if (error.message === "Order not found") {
      return errorResponse("Order not found", 404);
    }

    // Handle validation errors
    if (error.message.includes("Invalid status")) {
      return errorResponse(error.message, 400);
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

