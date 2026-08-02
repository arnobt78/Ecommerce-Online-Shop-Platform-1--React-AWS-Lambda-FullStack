// Parent: REQ-1200, REQ-1207, REQ-1301 — parity with aws-lambda/functions/payment/*.js
// NOTE: the /payment/webhook route requires the RAW request body for Stripe
// signature verification — app.ts mounts express.raw() for that exact path
// before the global express.json() middleware runs (see app.ts comment).

import express, { type Request, type Response } from "express";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { successResponse, errorResponse } from "../lib/response";
import { optionalAuth } from "../lib/auth";
import { paymentLimiter } from "../lib/rateLimit";
import * as ordersService from "../services/orders.service";
import { getProductsByIds } from "../services/products.service";
import { validateAndApplyCoupon } from "../services/coupons.service";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const router = express.Router();

interface CartLineItem {
  id?: unknown;
  quantity?: unknown;
}

// POST /payment/create-intent — REQ-1659: optionalAuth instead of requireAuth
// so a guest (no account) can check out too, provided they supply a valid
// guestEmail. Authenticated checkout is completely unaffected.
router.post("/payment/create-intent", paymentLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);

    const { cartList, currency = "usd", couponCode, guestEmail } = req.body || {};
    if (!Array.isArray(cartList) || cartList.length === 0) {
      return errorResponse(res, "Cart is empty.", 400);
    }

    // REQ-1659: a guest must supply a valid-looking email; a logged-in user
    // needs nothing extra. This is the one place a synthetic "guest_<uuid>"
    // identity is minted — reused as-is by /orders below via metadata.userId,
    // never a real User.id, so every existing `order.userId !== req.user.id`
    // ownership check elsewhere in the codebase keeps working unmodified.
    const isGuestCheckout = !req.user;
    if (isGuestCheckout && (typeof guestEmail !== "string" || !/^\S+@\S+\.\S+$/.test(guestEmail))) {
      return errorResponse(res, "A valid email is required to check out as a guest.", 400);
    }
    const effectiveUserId = req.user?.id || `guest_${randomUUID()}`;
    const effectiveUserEmail = req.user?.email || guestEmail;
    const effectiveUserName = req.user?.name || "Guest";

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

    // REQ-1658: coupon discount is recomputed server-side from the same
    // server-computed subtotal above — never trust a client-sent discount.
    let discountAmountCents = 0;
    let appliedCouponCode: string | undefined;
    if (typeof couponCode === "string" && couponCode.trim()) {
      try {
        const result = await validateAndApplyCoupon(couponCode, amountInCents);
        discountAmountCents = result.discountAmountCents;
        appliedCouponCode = result.coupon.code;
      } catch (couponError) {
        return errorResponse(res, couponError instanceof Error ? couponError.message : "Invalid coupon code", 400);
      }
    }
    amountInCents = Math.max(0, amountInCents - discountAmountCents);

    if (amountInCents < 50) {
      return errorResponse(res, "Invalid order total. Minimum is $0.50.", 400);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: typeof currency === "string" ? currency.toLowerCase() : "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        // Trusted fields set from the verified JWT (or the freshly-minted
        // guest identity above) last, so nothing in the request body can
        // spoof another user's identity on this charge — handlePaymentSuccess()
        // below and /orders both trust metadata.userId, never the request body.
        userId: effectiveUserId,
        userEmail: effectiveUserEmail || "",
        userName: effectiveUserName,
        itemCount: String(cartList.length),
        ...(isGuestCheckout && { isGuest: "true" }),
        ...(appliedCouponCode && { couponCode: appliedCouponCode, discountAmount: String(discountAmountCents) }),
      },
    });

    return successResponse(res, {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      // REQ-1659: the frontend reuses this exact userId (real or synthetic
      // guest id) when it later calls POST /orders for this same payment.
      userId: effectiveUserId,
      isGuest: isGuestCheckout,
      ...(appliedCouponCode && { couponCode: appliedCouponCode, discountAmount: discountAmountCents }),
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

// GET /payment/verify/:id — REQ-1659: optionalAuth so a guest can verify
// their own just-created payment intent too. The paymentIntentId itself is
// an unguessable Stripe-generated id (functions like a bearer secret for the
// guest's own checkout session), so a guest payment intent is readable by
// anyone holding that id — same trust model as the Stripe clientSecret
// already handed to the browser for this exact payment.
router.get("/payment/verify/:id", paymentLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);

    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.id!);
    const isGuestPaymentIntent = paymentIntent.metadata?.isGuest === "true";
    if (!isGuestPaymentIntent && paymentIntent.metadata?.userId !== req.user?.id) {
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
  const isGuest = metadata?.isGuest === "true";
  await ordersService.createOrder({
    cartList: [],
    amount_paid: amount / 100,
    quantity: 0,
    user: { id: userId, email: metadata?.userEmail, name: metadata?.userName || "Guest" },
    paymentIntentId,
    paymentStatus: "paid",
    status: "pending",
    ...(isGuest && { isGuest: true, guestEmail: metadata?.userEmail }),
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
