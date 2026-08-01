// Parent: REQ-1200, REQ-1301, REQ-1304 — parity with aws-lambda/functions/orders/index.js and
// aws-lambda/functions/admin/{orders,order-detail,order-status,refund-order,
// generate-label,add-tracking}.js. Public routes mounted at /orders, admin
// routes at /admin/orders (see app.ts).

import express, { type Request, type Response } from "express";
import Stripe from "stripe";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logActivity, getOrderActivityTimeline } from "../services/activityLog.service";
import * as ordersService from "../services/orders.service";
import { createOrderSchema } from "../services/orders.service";
import { incrementProductStock } from "../services/products.service";
import { generateShippoLabel } from "../services/shipping.service";

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

// POST /orders — parity with functions/orders/index.js POST.
publicRouter.post("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid order data", 400);
    }
    if (parsed.data.user.id !== req.user!.id) {
      return errorResponse(res, "Unauthorized: User ID mismatch", 403);
    }
    const order = await ordersService.createOrder(parsed.data);
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

// GET /admin/orders/:id — parity with functions/admin/order-detail.js
adminRouter.get("/admin/orders/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const order = await ordersService.getOrderById(req.params.id!);
    if (!order) return errorResponse(res, "Order not found", 404);
    return successResponse(res, order);
  } catch (error) {
    console.error("Admin order detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /admin/orders/:id/status — parity with functions/admin/order-status.js
adminRouter.put("/admin/orders/:id/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id!;
    const { status } = req.body || {};
    if (!status) return errorResponse(res, "Status is required", 400);

    const existingOrder = await ordersService.getOrderById(orderId);
    if (!existingOrder) return errorResponse(res, "Order not found", 404);

    const updatedOrder = await ordersService.updateOrderStatus(orderId, status);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: orderId,
      details: { previousStatus: existingOrder.status, newStatus: status, orderId },
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

    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) {
      return errorResponse(res, "Order does not have a payment intent ID. Cannot process refund.", 400);
    }

    const wasAlreadyCancelled = order.status === "cancelled";
    const { amount, reason } = req.body || {};

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId = paymentIntent.latest_charge;
    if (!chargeId) {
      return errorResponse(res, "Payment intent does not have a charge. Cannot process refund.", 400);
    }

    const refundParams: Stripe.RefundCreateParams = {
      charge: typeof chargeId === "string" ? chargeId : chargeId.id,
      reason: reason || "requested_by_customer",
    };
    if (amount && typeof amount === "number" && amount > 0) {
      const orderAmountInCents = Math.round((order.amount_paid || 0) * 100);
      if (amount > orderAmountInCents) {
        return errorResponse(res, `Refund amount (${amount} cents) exceeds order amount (${orderAmountInCents} cents)`, 400);
      }
      refundParams.amount = amount;
    }

    const refund = await stripe.refunds.create(refundParams);

    const stockRestoreResults: Array<Record<string, unknown>> = [];
    const cartList = order.cartList as Array<{ id?: string; name?: string; productName?: string; quantity?: number }>;
    if (!wasAlreadyCancelled && Array.isArray(cartList)) {
      for (const item of cartList) {
        if (!item.id || !item.quantity) continue;
        try {
          const updatedProduct = await incrementProductStock(item.id, item.quantity);
          stockRestoreResults.push({
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            newStock: updatedProduct.stock,
            success: true,
          });
        } catch (stockError) {
          stockRestoreResults.push({
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            success: false,
            error: stockError instanceof Error ? stockError.message : String(stockError),
          });
        }
      }
    }

    const refundAmount = refund.amount;
    const updatedOrder = await ordersService.updateOrderWithRefund(orderId, refund.id, refundAmount);

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
        refundAmount,
        paymentIntentId,
        orderId,
      },
    });

    return successResponse(res, {
      ...updatedOrder,
      refundId: refund.id,
      refundAmount,
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
