// Parent: REQ-1200, REQ-1207, REQ-1301 — parity with aws-lambda/functions/payment/*.js
// NOTE: the /payment/webhook route requires the RAW request body for Stripe
// signature verification — app.ts mounts express.raw() for that exact path
// before the global express.json() middleware runs (see app.ts comment).

import express, { type Request, type Response } from "express";
import Stripe from "stripe";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import { paymentLimiter } from "../lib/rateLimit";
import * as ordersService from "../services/orders.service";
import { getProductsByIds } from "../services/products.service";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const router = express.Router();

interface CartLineItem {
  id?: unknown;
  quantity?: unknown;
}

// POST /payment/create-intent
router.post("/payment/create-intent", paymentLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);

    const { cartList, currency = "usd" } = req.body || {};
    if (!Array.isArray(cartList) || cartList.length === 0) {
      return errorResponse(res, "Cart is empty.", 400);
    }

    // Security: the charge amount is never trusted from the client — it is
    // always recomputed here from live DB prices, so a tampered request body
    // can't create a Stripe charge for less than the real cart total.
    const ids = (cartList as CartLineItem[])
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const products = await getProductsByIds(ids);
    const priceById = new Map(products.map((p) => [p.id, p.price]));

    let amountInCents = 0;
    for (const item of cartList as CartLineItem[]) {
      const price = typeof item.id === "string" ? priceById.get(item.id) : undefined;
      if (price === undefined) {
        return errorResponse(res, `Product ${typeof item.id === "string" ? item.id : ""} no longer exists.`, 400);
      }
      const quantity = typeof item.quantity === "number" && item.quantity > 0 ? Math.floor(item.quantity) : 1;
      amountInCents += Math.round(price * 100) * quantity;
    }

    if (amountInCents < 50) {
      return errorResponse(res, "Invalid order total. Minimum is $0.50.", 400);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: typeof currency === "string" ? currency.toLowerCase() : "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        // Trusted fields set from the verified JWT last, so nothing in the
        // request body can spoof another user's identity on this charge —
        // handlePaymentSuccess() below trusts metadata.userId for the webhook
        // fallback order-creation path.
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name || "Guest",
        itemCount: String(cartList.length),
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
