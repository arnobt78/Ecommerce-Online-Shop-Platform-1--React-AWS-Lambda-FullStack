/**
 * Stripe Webhook Handler Lambda Function
 *
 * Handles Stripe webhook events (payment success, failure, etc.)
 * This uses Stripe's latest webhook signature verification.
 *
 * Endpoint: POST /payment/webhook
 * Requires: Stripe webhook signature verification (no JWT auth)
 */

const Stripe = require("stripe");
const { successResponse, errorResponse, handleOptions } = require("../../shared/response");
const { createOrder, getOrdersByUserId } = require("../../shared/orders");

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY);

// Webhook secret from environment (required for security)
// Never hardcode webhook secrets - always use environment variables
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error("ERROR: STRIPE_WEBHOOK_SECRET environment variable is not set!");
  console.error("Webhook signature verification will fail. Set this in Lambda environment variables.");
}

/**
 * Handle payment_intent.succeeded event
 * Updates order status if order exists, otherwise creates minimal order record
 * Note: Frontend creates the full order with cart items, webhook just ensures payment is recorded
 */
async function handlePaymentSuccess(paymentIntent) {
  try {
    const { metadata, amount, currency, id: paymentIntentId } = paymentIntent;

    // Extract order data from metadata
    const userId = metadata?.userId;
    const userEmail = metadata?.userEmail;
    const userName = metadata?.userName || "Guest";

    if (!userId) {
      console.error("Missing userId in payment intent metadata");
      return;
    }

    // Check if order with this paymentIntentId already exists
    // Frontend creates order with full cart details, webhook just ensures payment is recorded
    const userOrders = await getOrdersByUserId(userId);
    const existingOrder = userOrders.find(
      (order) => order.paymentIntentId === paymentIntentId
    );

    if (existingOrder) {
      // Order already exists (created by frontend), just log
      console.log(
        `Order ${existingOrder.id} already exists for payment intent: ${paymentIntentId}`
      );
      return;
    }

    // If no order exists, create a minimal order record
    // This is a fallback - normally frontend creates the order
    const order = {
      userId: userId,
      amount_paid: amount / 100, // Convert cents to dollars
      quantity: 0, // Will be updated if frontend creates order later
      cartList: [], // Will be populated if frontend creates order later
      user: {
        id: userId,
        email: userEmail,
        name: userName,
      },
      paymentIntentId: paymentIntentId,
      paymentStatus: "paid",
      status: "pending",
    };

    // Create minimal order in DynamoDB
    await createOrder(order);

    console.log(
      `Minimal order created for payment intent: ${paymentIntentId} (frontend should create full order)`
    );
  } catch (error) {
    console.error("Error handling payment success:", error);
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailure(paymentIntent) {
  console.log(`Payment failed for intent: ${paymentIntent.id}`);
  // You might want to log this or send notification to admin
}

exports.handler = async (event, context) => {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  // Handle CORS preflight
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (httpMethod !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // Check if webhook secret is configured
    if (!WEBHOOK_SECRET) {
      console.error("ERROR: STRIPE_WEBHOOK_SECRET environment variable is not set!");
      return errorResponse(
        "Webhook secret not configured. Please set STRIPE_WEBHOOK_SECRET in Lambda environment variables.",
        500
      );
    }

    // Get Stripe signature from headers
    const signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];

    if (!signature) {
      return errorResponse("Missing Stripe signature", 400);
    }

    // Get raw body (Lambda HTTP API v2 provides body as string, may be base64 encoded)
    let body = event.body || "";
    
    // Handle base64 encoded body if needed (Lambda HTTP API v2 may encode binary content)
    if (event.isBase64Encoded) {
      body = Buffer.from(body, "base64").toString("utf-8");
    }

    // Verify webhook signature (requires raw body string)
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return errorResponse(`Webhook signature verification failed: ${err.message}`, 400);
    }

    // Handle different event types
    switch (stripeEvent.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(stripeEvent.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailure(stripeEvent.data.object);
        break;

      case "payment_intent.canceled":
        console.log(`Payment canceled: ${stripeEvent.data.object.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    // Return success to Stripe
    return successResponse({ received: true }, 200);
  } catch (error) {
    console.error("Webhook Error:", error);
    return errorResponse(
      { message: error.message || "Internal server error", error: error.name || "UnknownError" },
      500
    );
  }
};

