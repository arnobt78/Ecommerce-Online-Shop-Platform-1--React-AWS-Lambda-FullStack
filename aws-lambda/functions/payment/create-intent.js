/**
 * Create Stripe Payment Intent Lambda Function
 *
 * Creates a Stripe payment intent for checkout.
 * This uses Stripe's latest Payment Intents API.
 *
 * Endpoint: POST /payment/create-intent
 * Requires: Authentication (Bearer token)
 */

const Stripe = require("stripe");
const { requireAuth } = require("../../shared/auth");
const { successResponse, errorResponse, handleOptions } = require("../../shared/response");

// Initialize Stripe with secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY or STRIPE_API_KEY environment variable is not set");
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

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
    // Check if Stripe is initialized
    if (!stripe) {
      console.error("Stripe is not initialized - missing STRIPE_SECRET_KEY or STRIPE_API_KEY");
      return errorResponse("Payment service is not configured. Please contact support.", 500);
    }

    // Authenticate user
    const user = requireAuth(event);

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { amount, currency = "usd", metadata = {} } = body;

    // Validate amount
    if (!amount || typeof amount !== "number" || amount < 50) {
      // Minimum $0.50 (50 cents)
      return errorResponse("Invalid amount. Minimum is $0.50.", 400);
    }

    // Create payment intent with latest Stripe API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true, // Enable all payment methods (cards, wallets, etc.)
      },
      metadata: {
        userId: user.id,
        userEmail: user.email,
        userName: user.name || "Guest",
        ...metadata,
      },
    });

    // Return client secret for frontend
    return successResponse(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      200
    );
  } catch (error) {
    console.error("Create Payment Intent Error:", error);

    // Handle Stripe-specific errors
    if (error.type === "StripeCardError") {
      return errorResponse(
        { message: error.message, error: "CardError", code: error.code },
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

