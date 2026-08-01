/**
 * Verify Payment Status Lambda Function
 *
 * Verifies the status of a Stripe payment intent.
 * Used after payment redirect to confirm payment status.
 *
 * Endpoint: GET /payment/verify/{paymentIntentId}
 * Requires: Authentication (Bearer token)
 */

const Stripe = require("stripe");
const { requireAuth } = require("../../shared/auth");
const { successResponse, errorResponse, handleOptions } = require("../../shared/response");

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY);

exports.handler = async (event, context) => {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  // Handle CORS preflight
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (httpMethod !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  try {
    // Authenticate user
    const user = requireAuth(event);

    // Get payment intent ID from path parameters
    const paymentIntentId = event.pathParameters?.id || event.pathParameters?.paymentIntentId;

    if (!paymentIntentId) {
      return errorResponse("Payment intent ID is required in path", 400);
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify that this payment intent belongs to the authenticated user
    if (paymentIntent.metadata?.userId !== user.id) {
      return errorResponse("Payment intent does not belong to this user", 403);
    }

    // Return payment status
    return successResponse(
      {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      },
      200
    );
  } catch (error) {
    console.error("Verify Payment Error:", error);

    // Handle Stripe-specific errors
    if (error.type === "StripeInvalidRequestError") {
      return errorResponse(
        { message: error.message, error: "InvalidRequestError", code: error.code },
        400
      );
    }

    if (error.message?.includes("Unauthorized") || error.message?.includes("Invalid token")) {
      return errorResponse({ message: error.message, error: "UnauthorizedError" }, 401);
    }

    return errorResponse(
      { message: error.message || "Internal server error", error: error.name || "UnknownError" },
      500
    );
  }
};

