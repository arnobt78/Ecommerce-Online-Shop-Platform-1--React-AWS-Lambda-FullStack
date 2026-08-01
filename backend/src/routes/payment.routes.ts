// Parent: REQ-1200, REQ-1207, REQ-1301 — parity with aws-lambda/functions/payment/*.js
// NOTE: the /payment/webhook route requires the RAW request body for Stripe
// signature verification — app.ts mounts express.raw() for that exact path
// before the global express.json() middleware runs (see app.ts comment).

import express, { type Request, type Response } from "express";
import Stripe from "stripe";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import * as ordersService from "../services/orders.service";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const router = express.Router();

// POST /payment/create-intent
router.post("/payment/create-intent", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);

    const { amount, currency = "usd", metadata = {} } = req.body || {};
    if (!amount || typeof amount !== "number" || amount < 50) {
      return errorResponse(res, "Invalid amount. Minimum is $0.50.", 400);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name || "Guest",
        ...metadata,
      },
    });

    return successResponse(res, {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error("Create payment intent error:", error);
    const stripeError = error as { type?: string; message?: string; code?: string };
    if (stripeError.type === "StripeCardError") {
      return errorResponse(res, { message: stripeError.message || "Card error", error: "CardError", code: stripeError.code || "" }, 400);
    }
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /payment/verify/:id
router.get("/payment/verify/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);

    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.id!);
    if (paymentIntent.metadata?.userId !== req.user!.id) {
      return errorResponse(res, "Payment intent does not belong to this user", 403);
    }

    return successResponse(res, {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    const stripeError = error as { type?: string; message?: string; code?: string };
    if (stripeError.type === "StripeInvalidRequestError") {
      return errorResponse(res, { message: stripeError.message || "Invalid request", error: "InvalidRequestError", code: stripeError.code || "" }, 400);
    }
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const { metadata, amount, id: paymentIntentId } = paymentIntent;
  const userId = metadata?.userId;
  if (!userId) {
    console.error("Missing userId in payment intent metadata");
    return;
  }

  const userOrders = await ordersService.getOrdersByUserId(userId);
  const existingOrder = userOrders.find((order) => order.paymentIntentId === paymentIntentId);
  if (existingOrder) {
    console.log(`Order ${existingOrder.id} already exists for payment intent: ${paymentIntentId}`);
    return;
  }

  // Fallback: frontend normally creates the full order with cart details;
  // this covers the edge case where the webhook fires before that happens.
  await ordersService.createOrder({
    cartList: [],
    amount_paid: amount / 100,
    quantity: 0,
    user: { id: userId, email: metadata?.userEmail, name: metadata?.userName || "Guest" },
    paymentIntentId,
    paymentStatus: "paid",
    status: "pending",
  });
}

// POST /payment/webhook — no JWT auth, verified via Stripe signature instead.
router.post("/payment/webhook", async (req: Request, res: Response) => {
  try {
    if (!WEBHOOK_SECRET) {
      return errorResponse(res, "Webhook secret not configured. Set STRIPE_WEBHOOK_SECRET.", 500);
    }
    if (!stripe) {
      return errorResponse(res, "Payment service is not configured. Please contact support.", 500);
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) return errorResponse(res, "Missing Stripe signature", 400);

    let stripeEvent: Stripe.Event;
    try {
      // req.body is a raw Buffer here (see app.ts webhook body-parsing note).
      stripeEvent = stripe.webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Webhook signature verification failed:", message);
      return errorResponse(res, `Webhook signature verification failed: ${message}`, 400);
    }

    switch (stripeEvent.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(stripeEvent.data.object);
        break;
      case "payment_intent.payment_failed":
        console.log(`Payment failed for intent: ${stripeEvent.data.object.id}`);
        break;
      case "payment_intent.canceled":
        console.log(`Payment canceled: ${stripeEvent.data.object.id}`);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${stripeEvent.type}`);
    }

    return successResponse(res, { received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
