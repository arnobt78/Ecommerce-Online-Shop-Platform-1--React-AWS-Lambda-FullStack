// Parent: REQ-1200, REQ-1301, REQ-1304 — parity with aws-lambda/functions/orders/index.js and
// aws-lambda/functions/admin/{orders,order-detail,order-status,refund-order,
// generate-label,add-tracking}.js. Public routes mounted at /orders, admin
// routes at /admin/orders (see app.ts).

import express, { type Request, type Response } from "express";
import Stripe from "stripe";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin, optionalAuth } from "../lib/auth";
import { paymentLimiter } from "../lib/rateLimit";
import { logActivity, getOrderActivityTimeline } from "../services/activityLog.service";
import * as ordersService from "../services/orders.service";
import { createOrderSchema } from "../services/orders.service";
import { generateShippoLabel } from "../services/shipping.service";
import { generateInvoicePdf } from "../services/invoice.service";
import { toCsv } from "../lib/csv";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const publicRouter = express.Router();
export const adminRouter = express.Router();

// GET /orders — always the authenticated user's own orders (dashboard), regardless of role.
// Parity with functions/orders/index.js GET.
publicRouter.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const userIdParam = req.query["user.id"];
    if (userIdParam && userIdParam !== req.user!.id) {
      return errorResponse(res, "Unauthorized: Cannot access other user's orders", 403);
    }
    const orders = await ordersService.getOrdersByUserId(req.user!.id);
    return successResponse(res, orders);
  } catch (error) {
    console.error("Orders list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /orders/:id — REQ-1617: single-order detail for the customer-facing
// order detail page, ownership-checked (or admin), with the status-change
// timeline embedded in the same response (avoids a second round-trip).
publicRouter.get("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id!;
    const order = await ordersService.getOrderById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);

    if (order.userId !== req.user!.id && req.user!.role !== "admin") {
      return errorResponse(res, "Unauthorized: Cannot access another user's order", 403);
    }

    const timeline = await getOrderActivityTimeline(orderId);
    return successResponse(res, { ...order, timeline });
  } catch (error) {
    console.error("Order detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /orders/guest/:orderId?email= — REQ-1659: no-auth lookup for a guest's
// own order (order id + the exact email used at checkout must both match —
// the id alone is a UUID and not realistically guessable, and requiring the
// email too means a leaked/shared order-confirmation link can't be replayed
// by itself to load a stranger's order).
publicRouter.get("/orders/guest/:orderId", paymentLimiter, async (req: Request, res: Response) => {
  try {
    const email = typeof req.query.email === "string" ? req.query.email : "";
    if (!email) return errorResponse(res, "Email is required", 400);

    const order = await ordersService.getOrderById(req.params.orderId!);
    if (!order || !order.isGuest || (order.guestEmail || "").toLowerCase() !== email.toLowerCase()) {
      return errorResponse(res, "Order not found", 404);
    }

    const timeline = await getOrderActivityTimeline(order.id);
    return successResponse(res, { ...order, timeline });
  } catch (error) {
    console.error("Guest order lookup error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /orders/:id/invoice — REQ-1640: on-demand PDF download, reusing the
// same generateInvoicePdf() the order-confirmation email already attaches
// (REQ-1612) instead of a separate invoice-storage system.
publicRouter.get("/orders/:id/invoice", requireAuth, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id!;
    const order = await ordersService.getOrderById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);

    if (order.userId !== req.user!.id && req.user!.role !== "admin") {
      return errorResponse(res, "Unauthorized: Cannot access another user's order", 403);
    }

    const orderUser = order.user as { name?: string; email?: string } | null;
    const cartList = Array.isArray(order.cartList) ? (order.cartList as Array<{ name?: string; productName?: string; quantity?: number; price?: number }>) : [];

    const pdfBuffer = await generateInvoicePdf({
      orderId: order.id,
      orderDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : undefined,
      customerName: orderUser?.name,
      customerEmail: orderUser?.email,
      items: cartList,
      total: order.amount_paid,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Invoice generation error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to generate invoice" }, 500);
  }
});

// POST /orders — parity with functions/orders/index.js POST. REQ-1659:
// optionalAuth instead of requireAuth so a guest checkout can create its
// order too; a guest MUST supply a paymentIntentId (no "pay later" guest
// flow) and its identity is verified entirely against the Stripe
// PaymentIntent's own metadata below, never trusted from the request body.
publicRouter.post("/orders", paymentLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid order data", 400);
    }

    if (req.user) {
      if (parsed.data.user.id !== req.user.id) {
        return errorResponse(res, "Unauthorized: User ID mismatch", 403);
      }
    } else if (!parsed.data.paymentIntentId) {
      return errorResponse(res, "Guest checkout requires a completed payment", 400);
    }

    // Security: amount_paid must reflect what Stripe actually charged, not
    // whatever the client sends — verified against the PaymentIntent instead
    // of trusted from the request body (mirrors the recomputation done at
    // charge time in payment.routes.ts).
    let amountPaid = parsed.data.amount_paid;
    // REQ-1658: coupon fields are read from the verified PaymentIntent's own
    // metadata below, overwriting anything the client sent in parsed.data.
    let couponCode: string | undefined;
    let discountAmount: number | undefined;
    let isGuest = false;
    let guestEmail: string | undefined;
    if (parsed.data.paymentIntentId) {
      if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);
      const paymentIntent = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId);
      isGuest = paymentIntent.metadata?.isGuest === "true";

      if (req.user) {
        if (paymentIntent.metadata?.userId !== req.user.id) {
          return errorResponse(res, "Payment intent does not belong to this user", 403);
        }
      } else {
        // REQ-1659: guest identity is the synthetic id minted at create-intent
        // time — must match both the metadata AND what the client claims.
        if (!isGuest || paymentIntent.metadata?.userId !== parsed.data.user.id) {
          return errorResponse(res, "Payment intent does not belong to this guest checkout", 403);
        }
        guestEmail = paymentIntent.metadata?.userEmail || undefined;
      }

      if (paymentIntent.status !== "succeeded") {
        return errorResponse(res, "Payment has not succeeded yet", 400);
      }
      amountPaid = paymentIntent.amount / 100;
      couponCode = paymentIntent.metadata?.couponCode || undefined;
      discountAmount = paymentIntent.metadata?.discountAmount ? Number(paymentIntent.metadata.discountAmount) : undefined;
    }

    const order = await ordersService.createOrder({ ...parsed.data, amount_paid: amountPaid, couponCode, discountAmount, isGuest, guestEmail });
    return successResponse(res, order, 201);
  } catch (error) {
    console.error("Order create error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /admin/orders — parity with functions/admin/orders.js
adminRouter.get("/admin/orders", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const orders = await ordersService.getAllOrders();
    return successResponse(res, orders);
  } catch (error) {
    console.error("Admin orders list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /admin/orders/export — REQ-1662: export only, no import counterpart.
// Orders are historical transactional records created exclusively through
// the real checkout flow (Stripe payment verification, stock
// decrement/idempotency, REQ-1637/1641) — bulk-creating them from a CSV
// would bypass every one of those guarantees and is a data-integrity/fraud
// risk, not a legitimate admin workflow. Products (a catalog, not a ledger)
// don't carry that risk, which is why only products get an import route.
adminRouter.get("/admin/orders/export", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const orders = await ordersService.getAllOrders();
    const rows = orders.map((o) => {
      const orderUser = o.user as { name?: string; email?: string } | null;
      return {
        id: o.id,
        customerName: orderUser?.name ?? "",
        customerEmail: orderUser?.email ?? "",
        amount_paid: o.amount_paid,
        quantity: o.quantity,
        status: o.status,
        paymentStatus: o.paymentStatus ?? "",
        paymentIntentId: o.paymentIntentId ?? "",
        trackingNumber: o.trackingNumber ?? "",
        trackingCarrier: o.trackingCarrier ?? "",
        couponCode: o.couponCode ?? "",
        discountAmount: o.discountAmount != null ? (o.discountAmount / 100).toFixed(2) : "",
        refundAmount: o.refundAmount != null ? (o.refundAmount / 100).toFixed(2) : "",
        isGuest: String(o.isGuest),
        createdAt: o.createdAt.toISOString(),
      };
    });

    const columns = [
      "id", "customerName", "customerEmail", "amount_paid", "quantity", "status", "paymentStatus",
      "paymentIntentId", "trackingNumber", "trackingCarrier", "couponCode", "discountAmount",
      "refundAmount", "isGuest", "createdAt",
    ];
    const csv = toCsv(rows, columns);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("Order export error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to export orders" }, 500);
  }
});

// GET /admin/orders/:id — parity with functions/admin/order-detail.js
adminRouter.get("/admin/orders/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const order = await ordersService.getOrderById(req.params.id!);
    if (!order) return errorResponse(res, "Order not found", 404);
    // REQ-1646: admins previously had no timeline visibility at all — only the
    // customer-facing GET /orders/:id included it. Same call, same shape.
    const timeline = await getOrderActivityTimeline(req.params.id!);
    return successResponse(res, { ...order, timeline });
  } catch (error) {
    console.error("Admin order detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /admin/orders/:id/status — parity with functions/admin/order-status.js
adminRouter.put("/admin/orders/:id/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id!;
    const { status, reason: rawReason } = (req.body || {}) as { status?: unknown; reason?: unknown };
    if (!status || typeof status !== "string") return errorResponse(res, "Status is required", 400);
    const reason = typeof rawReason === "string" ? rawReason : undefined;

    const existingOrder = await ordersService.getOrderById(orderId);
    if (!existingOrder) return errorResponse(res, "Order not found", 404);

    // REQ-1639: cancelling an order that's already been paid must actually
    // return the customer's money, not just relabel the order — reuses the
    // exact same Stripe refund flow as the explicit "Process Refund" action
    // instead of leaving a "cancelled" order that silently kept the payment.
    const isCancellingPaidOrder =
      status === "cancelled" && existingOrder.paymentStatus === "paid" && existingOrder.status !== "refunded" && !!existingOrder.paymentIntentId;

    if (isCancellingPaidOrder) {
      const { updatedOrder, refund, stockRestoreResults } = await ordersService.refundOrderPayment(existingOrder, { reason });

      logActivity({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        action: "status_change",
        entityType: "order",
        entityId: orderId,
        details: {
          previousStatus: existingOrder.status,
          newStatus: "refunded",
          refundId: refund.id,
          refundAmount: refund.amount,
          reason: reason || null,
          cancelledWithRefund: true,
          orderId,
        },
      });

      return successResponse(res, {
        ...updatedOrder,
        refundId: refund.id,
        refundAmount: refund.amount,
        refundStatus: refund.status,
        _stockRestores: stockRestoreResults,
      });
    }

    const updatedOrder = await ordersService.updateOrderStatus(orderId, status);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: { previousStatus: existingOrder.status, newStatus: status, reason: reason || null, orderId },
    });

    return successResponse(res, updatedOrder);
  } catch (error) {
    console.error("Order status update error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Order not found") return errorResponse(res, message, 404);
    if (message.startsWith("Invalid status")) return errorResponse(res, message, 400);
    return errorResponse(res, { message }, 500);
  }
});

// POST /admin/orders/:id/tracking — parity with functions/admin/add-tracking.js
adminRouter.post("/admin/orders/:id/tracking", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id!;
    const order = await ordersService.getOrderById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);

    const { trackingNumber, trackingCarrier, status } = req.body || {};
    if (!trackingNumber || typeof trackingNumber !== "string" || !trackingNumber.trim()) {
      return errorResponse(res, "Tracking number is required", 400);
    }

    const updatedOrder = await ordersService.updateOrderTracking(orderId, {
      trackingNumber: trackingNumber.trim(),
      trackingCarrier: trackingCarrier || "usps",
      status: status || "shipped",
    });

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: order.status,
        newStatus: status || "shipped",
        trackingNumber: trackingNumber.trim(),
        trackingCarrier: trackingCarrier || "usps",
        orderId,
      },
    });

    const orderUser = updatedOrder.user as { name?: string; email?: string } | null;
    const prevOrderUser = order.user as { name?: string; email?: string } | null;

    return successResponse(res, {
      orderId: updatedOrder.id,
      trackingNumber: updatedOrder.trackingNumber,
      trackingCarrier: updatedOrder.trackingCarrier,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
      user: orderUser || prevOrderUser || null,
      userId: updatedOrder.userId || order.userId || null,
      userEmail: orderUser?.email || prevOrderUser?.email || null,
      userName: orderUser?.name || prevOrderUser?.name || null,
      message: "Tracking number added successfully",
    });
  } catch (error) {
    console.error("Add tracking error:", error);
    return errorResponse(res, error instanceof Error ? error.message : "Failed to add tracking number", 500);
  }
});

// POST /admin/orders/:id/generate-label — parity with functions/admin/generate-label.js
adminRouter.post("/admin/orders/:id/generate-label", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id!;
    const order = await ordersService.getOrderById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);

    const options = {
      carrier: req.body?.carrier,
      service: req.body?.service,
      fromAddress: req.body?.fromAddress,
      toAddress: req.body?.toAddress,
      length: req.body?.length,
      width: req.body?.width,
      height: req.body?.height,
    };

    const labelData = await generateShippoLabel(order, options);

    const updatedOrder = await ordersService.updateOrderTracking(orderId, {
      trackingNumber: labelData.trackingNumber,
      trackingCarrier: labelData.trackingCarrier,
      labelUrl: labelData.labelUrl ?? undefined,
      status: "shipped",
    });

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: order.status,
        newStatus: "shipped",
        trackingNumber: labelData.trackingNumber,
        trackingCarrier: labelData.trackingCarrier,
        labelGenerated: true,
        orderId,
      },
    });

    const orderUser = updatedOrder.user as { name?: string; email?: string } | null;
    const prevOrderUser = order.user as { name?: string; email?: string } | null;

    return successResponse(res, {
      orderId: updatedOrder.id,
      trackingNumber: updatedOrder.trackingNumber || labelData.trackingNumber || null,
      trackingCarrier: updatedOrder.trackingCarrier || labelData.trackingCarrier || "usps",
      labelUrl: updatedOrder.labelUrl || labelData.labelUrl || null,
      trackingUrl: labelData.trackingUrl || null,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
      user: orderUser || prevOrderUser || null,
      userId: updatedOrder.userId || order.userId || null,
      userEmail: orderUser?.email || prevOrderUser?.email || null,
      userName: orderUser?.name || prevOrderUser?.name || null,
      message: "Shipping label generated successfully",
    });
  } catch (error) {
    console.error("Generate label error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate shipping label";
    let statusCode = 500;
    if (message.includes("Incomplete shipping address") || message.includes("No shipping rates")) {
      statusCode = 400;
    } else if (message.includes("Shippo API")) {
      statusCode = 503;
    }
    return errorResponse(res, message, statusCode);
  }
});

// POST /admin/orders/:id/refund — parity with functions/admin/refund-order.js
adminRouter.post("/admin/orders/:id/refund", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!stripe) return errorResponse(res, "Payment service is not configured. Please contact support.", 500);

    const orderId = req.params.id!;
    const order = await ordersService.getOrderById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);

    if (order.paymentStatus === "refunded" || order.status === "refunded") {
      return errorResponse(res, "Order has already been refunded", 400);
    }
    if (!order.paymentIntentId) {
      return errorResponse(res, "Order does not have a payment intent ID. Cannot process refund.", 400);
    }

    const { amount, reason } = (req.body || {}) as { amount?: unknown; reason?: unknown };
    const { updatedOrder, refund, stockRestoreResults } = await ordersService.refundOrderPayment(order, {
      amount: typeof amount === "number" ? amount : undefined,
      reason: typeof reason === "string" ? reason : undefined,
    });

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: {
        previousStatus: order.status,
        newStatus: "refunded",
        refundId: refund.id,
        refundAmount: refund.amount,
        paymentIntentId: order.paymentIntentId,
        orderId,
        reason: reason || null,
      },
    });

    return successResponse(res, {
      ...updatedOrder,
      refundId: refund.id,
      refundAmount: refund.amount,
      refundStatus: refund.status,
      _stockRestores: stockRestoreResults,
    });
  } catch (error) {
    console.error("Refund order error:", error);
    const stripeError = error as { type?: string; message?: string };
    if (stripeError.type === "StripeCardError" || stripeError.type === "StripeInvalidRequestError") {
      return errorResponse(res, { message: stripeError.message || "Stripe refund failed", error: stripeError.type }, 400);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Order not found") return errorResponse(res, message, 404);
    return errorResponse(res, { message }, 500);
  }
});
