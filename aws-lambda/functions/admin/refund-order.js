/**
 * AWS Lambda Function: Admin - Refund Order
 *
 * This Lambda function handles POST requests to process refunds for orders (admin only).
 * Integrates with Stripe to process refunds and updates order status in DynamoDB.
 *
 * Endpoint: POST /admin/orders/{id}/refund
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Request Body (optional):
 * {
 *   "amount": 1000,  // Optional: Amount in cents to refund (partial refund). If not provided, full refund.
 *   "reason": "requested_by_customer" // Optional: Reason for refund
 * }
 *
 * Response:
 * {
 *   "id": "order_id",
 *   "refundId": "re_...",
 *   "refundAmount": 1000,
 *   "status": "refunded",
 *   "paymentStatus": "refunded",
 *   "updatedAt": "2025-12-04T...",
 *   ...
 * }
 */

const Stripe = require("stripe");
const { getOrderById } = require("../../shared/orders");
const { requireAuth } = require("../../shared/auth");
const { logActivity } = require("../../shared/activityLog");
const { getOrderById } = require("../../shared/orders");
const {
  successResponse,
  errorResponse,
  handleOptions,
} = require("../../shared/response");
const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDB, TABLES } = require("../../shared/dynamodb");
const { incrementProductStock } = require("../../shared/products");

// Initialize Stripe with secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY or STRIPE_API_KEY environment variable is not set");
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/**
 * Update order with refund information
 * @param {string} orderId - Order ID
 * @param {string} refundId - Stripe refund ID
 * @param {number} refundAmount - Refund amount in cents
 * @returns {Promise<Object>} Updated order
 */
async function updateOrderWithRefund(orderId, refundId, refundAmount) {
  const command = new UpdateCommand({
    TableName: TABLES.ORDERS,
    Key: { id: orderId },
    UpdateExpression:
      "SET #status = :status, paymentStatus = :paymentStatus, refundId = :refundId, refundAmount = :refundAmount, refundedAt = :refundedAt, updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#status": "status", // 'status' is a reserved word in DynamoDB
    },
    ExpressionAttributeValues: {
      ":status": "refunded",
      ":paymentStatus": "refunded",
      ":refundId": refundId,
      ":refundAmount": refundAmount,
      ":refundedAt": new Date().toISOString(),
      ":updatedAt": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW", // Return updated item
  });

  const result = await dynamoDB.send(command);
  return result.Attributes;
}

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object from HTTP API
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  // Log the incoming request for debugging
  console.log("Admin Order Refund Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow POST method
  if (httpMethod !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // Check if Stripe is initialized
    if (!stripe) {
      console.error("Stripe is not initialized - missing STRIPE_SECRET_KEY or STRIPE_API_KEY");
      return errorResponse("Payment service is not configured. Please contact support.", 500);
    }

    // Require authentication
    const decoded = requireAuth(event);

    // Check if user is admin - get role from JWT token
    if (decoded.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Extract order ID from path parameters
    const orderId = event.pathParameters?.id;
    if (!orderId) {
      return errorResponse("Order ID is required in path", 400);
    }

    // Get order by ID to check if it exists and get paymentIntentId
    const order = await getOrderById(orderId);
    if (!order) {
      return errorResponse("Order not found", 404);
    }

    // Check if order already refunded
    if (order.paymentStatus === "refunded" || order.status === "refunded") {
      return errorResponse("Order has already been refunded", 400);
    }

    // Check if order has paymentIntentId (required for refund)
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) {
      return errorResponse("Order does not have a payment intent ID. Cannot process refund.", 400);
    }

    // Check if order was already cancelled - stock was already restored on cancellation
    // Only restore stock if order was NOT cancelled (cancelled orders already had stock restored)
    const wasAlreadyCancelled = order.status === "cancelled";

    // Parse request body (optional - for partial refunds)
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return errorResponse("Invalid JSON in request body", 400);
    }

    const { amount, reason } = body;

    // Retrieve payment intent to get charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Get the charge ID from the payment intent
    const chargeId = paymentIntent.latest_charge;
    if (!chargeId) {
      return errorResponse("Payment intent does not have a charge. Cannot process refund.", 400);
    }

    // Prepare refund parameters
    const refundParams = {
      charge: chargeId,
      reason: reason || "requested_by_customer", // requested_by_customer, duplicate, fraudulent
    };

    // If amount is provided, do partial refund; otherwise full refund
    if (amount && typeof amount === "number" && amount > 0) {
      // Validate amount doesn't exceed order amount
      const orderAmountInCents = Math.round((order.amount_paid || 0) * 100);
      if (amount > orderAmountInCents) {
        return errorResponse(
          `Refund amount (${amount} cents) exceeds order amount (${orderAmountInCents} cents)`,
          400
        );
      }
      refundParams.amount = amount;
    }

    // Process refund with Stripe
    const refund = await stripe.refunds.create(refundParams);

    // Restore product stock when refund is processed
    // IMPORTANT: Only restore stock if order was NOT already cancelled
    // If order was cancelled, stock was already restored during cancellation
    // Refunding a cancelled order should NOT restore stock again
    const stockRestoreResults = [];
    if (!wasAlreadyCancelled && order.cartList && Array.isArray(order.cartList)) {
      for (const item of order.cartList) {
        if (item.id && item.quantity) {
          try {
            console.log(`🔄 Restoring stock for refunded order item:`, {
              productId: item.id,
              productName: item.name || item.productName || "Product",
              quantity: item.quantity,
            });
            
            const updatedProduct = await incrementProductStock(item.id, item.quantity);
            
            console.log(`✅ Stock restored for refunded order item:`, {
              productId: item.id,
              productName: item.name || item.productName || "Product",
              quantity: item.quantity,
              oldStock: updatedProduct.stock - item.quantity, // Calculate old stock
              newStock: updatedProduct.stock,
            });
            
            stockRestoreResults.push({
              productId: item.id,
              productName: item.name || item.productName || "Product",
              quantity: item.quantity,
              newStock: updatedProduct.stock,
              success: true,
            });
          } catch (stockError) {
            // Log error but continue with other products
            console.error(`Failed to restore stock for product ${item.id}:`, stockError.message);
            stockRestoreResults.push({
              productId: item.id,
              productName: item.name || item.productName || "Product",
              quantity: item.quantity,
              success: false,
              error: stockError.message,
            });
          }
        }
      }
      console.log("📦 Stock restored for refunded order:", {
        orderId,
        stockRestores: stockRestoreResults,
        totalItems: order.cartList?.length || 0,
        itemsProcessed: stockRestoreResults.length,
        successfulRestores: stockRestoreResults.filter(s => s.success).length,
        failedRestores: stockRestoreResults.filter(s => !s.success).length,
      });
    }

    // Get order before update for logging
    const orderBeforeUpdate = await getOrderById(orderId);

    // Update order with refund information
    const refundAmount = refund.amount; // Amount refunded in cents
    const updatedOrder = await updateOrderWithRefund(
      orderId,
      refund.id,
      refundAmount
    );

    // Log successful refund
    console.log("Refund processed successfully:", {
      orderId,
      refundId: refund.id,
      refundAmount,
      paymentIntentId,
    });

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: decoded.id,
      userEmail: decoded.email,
      userName: decoded.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: orderBeforeUpdate?.status || order.status,
        newStatus: "refunded",
        refundId: refund.id,
        refundAmount: refundAmount,
        paymentIntentId: paymentIntentId,
        orderId: orderId,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response with updated order
    // Include stock restore results for frontend to log and update UI
    return successResponse(
      {
        ...updatedOrder,
        refundId: refund.id,
        refundAmount: refundAmount,
        refundStatus: refund.status,
        _stockRestores: stockRestoreResults || [], // Internal field for frontend use
      },
      200
    );
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Admin Order Refund Error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    // Handle authentication errors
    if (
      error.message === "No token provided" ||
      error.message === "Invalid token"
    ) {
      return errorResponse("Unauthorized", 401);
    }

    // Handle Stripe-specific errors
    if (error.type === "StripeCardError" || error.type === "StripeInvalidRequestError") {
      return errorResponse(
        {
          message: error.message || "Stripe refund failed",
          error: error.type || "StripeError",
          code: error.code || "NO_CODE",
        },
        400
      );
    }

    // Handle not found errors
    if (error.message === "Order not found") {
      return errorResponse("Order not found", 404);
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

