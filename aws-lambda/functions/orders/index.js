/**
 * AWS Lambda Function: Orders
 *
 * This Lambda function handles GET and POST requests for orders.
 *
 * Endpoints:
 * - GET /orders - Get orders for authenticated user (user-specific, regardless of role)
 * - POST /orders - Create a new order
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * GET /orders:
 * - Returns orders for the authenticated user ONLY (filters by userId)
 * - This endpoint is for user dashboard - always returns user's own orders
 * - Admin users see their own orders here, not all orders
 * - To see all orders, use /admin/orders endpoint (admin panel)
 *
 * POST /orders:
 * Request Body:
 * {
 *   "cartList": [...],
 *   "amount_paid": 100,
 *   "quantity": 5,
 *   "user": { "id": "...", "name": "...", "email": "..." }
 * }
 */

const {
  getOrdersByUserId,
  createOrder,
  // getAllOrders is not used here - user dashboard should only show user's own orders
  // Admin panel uses separate /admin/orders endpoint
} = require("../../shared/orders");
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
  console.log("Orders Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  try {
    // Require authentication
    const decoded = requireAuth(event);

    if (httpMethod === "GET") {
      // IMPORTANT: This endpoint is for user dashboard - always returns user's own orders
      // Both admin and regular users see only their own orders here
      // Admin users should use /admin/orders endpoint to see all orders (admin panel)
      
      // Get userId from query parameter if provided (for explicit filtering)
      const userIdParam = event.queryStringParameters?.["user.id"];

      // Verify user can only access their own orders
      // If userIdParam is provided, it must match the authenticated user's ID
      if (userIdParam && userIdParam !== decoded.id) {
        return errorResponse("Unauthorized: Cannot access other user's orders", 403);
      }

      // Always filter by authenticated user's ID (regardless of role)
      // This ensures dashboard shows only the logged-in user's orders
      const orders = await getOrdersByUserId(decoded.id);
      return successResponse(orders, 200);
    }

    if (httpMethod === "POST") {
      // Parse request body
      let body;
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return errorResponse("Invalid JSON in request body", 400);
      }

      // Log the incoming order data for debugging
      console.log("Order data received:", {
        hasCartList: !!body.cartList,
        cartListLength: body.cartList?.length,
        amount_paid: body.amount_paid,
        quantity: body.quantity,
        userId: body.user?.id,
        decodedId: decoded.id,
      });

      // Create new order
      const orderData = body;

      // Verify the order belongs to the authenticated user
      const userId = orderData.user?.id;
      if (userId !== decoded.id) {
        return errorResponse("Unauthorized: User ID mismatch", 403);
      }

      const order = await createOrder(orderData);
      return successResponse(order, 201);
    }

    return errorResponse("Method not allowed. Use GET or POST.", 405);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Orders Error:", {
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
