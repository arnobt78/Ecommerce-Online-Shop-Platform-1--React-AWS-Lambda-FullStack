/**
 * AWS Lambda Function: Admin - Add Manual Tracking Number
 *
 * This Lambda function handles POST requests to add manual tracking numbers (admin only).
 * Used as a fallback when Shippo API is not available or admin prefers manual entry.
 *
 * Endpoint: POST /admin/orders/{id}/tracking
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Request Body:
 * {
 *   "trackingNumber": "9400111899223197428490", // Required: tracking number string
 *   "trackingCarrier": "usps", // Optional: carrier name (default: usps)
 *   "status": "shipped" // Optional: update status (default: shipped)
 * }
 *
 * Response:
 * {
 *   "orderId": "...",
 *   "trackingNumber": "9400111899223197428490",
 *   "trackingCarrier": "usps",
 *   "status": "shipped",
 *   "updatedAt": "2025-12-06T..."
 * }
 *
 * Notes:
 * - Automatically updates order status to "shipped" when tracking is added
 * - Validates tracking number is not empty
 * - Updates DynamoDB order record with tracking fields
 */

const { getOrderById, updateOrderTracking } = require("../../shared/orders");
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
  console.log("Admin Add Tracking Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  try {
    // Require authentication and admin role
    const user = await requireAuth(event);
    if (user.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Extract order ID from path parameters
    const orderId = event.pathParameters?.id;
    if (!orderId) {
      return errorResponse("Order ID is required", 400);
    }

    // Get order from database
    const order = await getOrderById(orderId);
    if (!order) {
      return errorResponse("Order not found", 404);
    }

    // Parse request body
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate tracking number
    const { trackingNumber, trackingCarrier, status } = body;
    if (
      !trackingNumber ||
      typeof trackingNumber !== "string" ||
      trackingNumber.trim().length === 0
    ) {
      return errorResponse("Tracking number is required", 400);
    }

    // Update order with tracking information
    const updatedOrder = await updateOrderTracking(orderId, {
      trackingNumber: trackingNumber.trim(),
      trackingCarrier: trackingCarrier || "usps", // Default to USPS if not specified
      status: status || "shipped", // Default to shipped when tracking is added
    });

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: order.status,
        newStatus: status || "shipped",
        trackingNumber: trackingNumber.trim(),
        trackingCarrier: trackingCarrier || "usps",
        orderId: orderId,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    // Include user data for email notifications
    return successResponse({
      orderId: updatedOrder.id,
      trackingNumber: updatedOrder.trackingNumber,
      trackingCarrier: updatedOrder.trackingCarrier,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
      // Include user data for email notifications
      user: updatedOrder.user || order.user || null,
      userId: updatedOrder.userId || order.userId || null,
      userEmail: updatedOrder.user?.email || order.user?.email || null,
      userName: updatedOrder.user?.name || order.user?.name || null,
      message: "Tracking number added successfully",
    });
  } catch (error) {
    console.error("Add tracking error:", {
      error: error.message,
      stack: error.stack,
      orderId: event.pathParameters?.id,
    });

    // Provide user-friendly error messages
    let errorMessage = "Failed to add tracking number";
    let statusCode = 500;

    if (error.message.includes("Order not found")) {
      errorMessage = "Order not found. Please verify the order ID.";
      statusCode = 404;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return errorResponse(errorMessage, statusCode);
  }
};
