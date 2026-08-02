// Parent: REQ-1660 — Shippo tracking-update webhook. Advances an order's
// status automatically (shipped -> delivered) instead of relying only on an
// admin manually flipping the status. Admin manual override remains fully
// available and unaffected.
//
// Verification note: unlike Stripe, Shippo's Track webhooks are not signed
// with an HMAC the receiver can verify. The standard mitigation (and the one
// used here) is a shared secret embedded directly in the webhook URL itself,
// set once when registering the webhook in the Shippo dashboard/API
// (SHIPPO_WEBHOOK_SECRET env var) — only a request that already knows the
// secret path segment is processed at all.

import express, { type Request, type Response } from "express";
import { timingSafeEqual } from "crypto";
import { successResponse, errorResponse } from "../lib/response";
import { logActivity } from "../services/activityLog.service";
import { sendTemplatedEmail } from "../services/email.service";
import * as ordersService from "../services/orders.service";
import { webhookLimiter } from "../lib/rateLimit";

function isValidWebhookSecret(presented: string, expected: string): boolean {
  const presentedBuf = Buffer.from(presented);
  const expectedBuf = Buffer.from(expected);
  return presentedBuf.length === expectedBuf.length && timingSafeEqual(presentedBuf, expectedBuf);
}

const router = express.Router();
const SHIPPO_WEBHOOK_SECRET = process.env.SHIPPO_WEBHOOK_SECRET;

interface ShippoTrackWebhookBody {
  event?: string;
  data?: {
    tracking_number?: string;
    tracking_status?: { status?: string; status_details?: string };
  };
}

// POST /webhooks/shippo/:secret
router.post("/webhooks/shippo/:secret", webhookLimiter, async (req: Request, res: Response) => {
  try {
    if (!SHIPPO_WEBHOOK_SECRET) {
      return errorResponse(res, "Shippo webhook secret not configured. Set SHIPPO_WEBHOOK_SECRET.", 500);
    }
    if (!isValidWebhookSecret(req.params.secret ?? "", SHIPPO_WEBHOOK_SECRET)) {
      return errorResponse(res, "Invalid webhook secret", 403);
    }

    const body = (req.body || {}) as ShippoTrackWebhookBody;
    const trackingNumber = body.data?.tracking_number;
    const shippoStatus = body.data?.tracking_status?.status;

    if (!trackingNumber || !shippoStatus) {
      // Not a shape we care about (or a test ping) — acknowledge without processing.
      return successResponse(res, { received: true, processed: false });
    }

    const order = await ordersService.getOrderByTrackingNumber(trackingNumber);
    if (!order) {
      // No matching order (could be a test-mode tracking number) — nothing to update.
      return successResponse(res, { received: true, processed: false });
    }

    // Only DELIVERED is auto-applied. TRANSIT/PRE_TRANSIT don't need to
    // overwrite "shipped" (already set at label-generation time), and
    // RETURNED/FAILURE need a human decision, not an automatic status flip.
    if (shippoStatus !== "DELIVERED" || order.status === "delivered" || order.status === "cancelled" || order.status === "refunded") {
      return successResponse(res, { received: true, processed: false });
    }

    await ordersService.updateOrderTracking(order.id, { status: "delivered" });

    await logActivity({
      userId: "system",
      userName: "Shippo Webhook",
      action: "status_change",
      entityType: "order",
      entityId: order.id,
      details: { previousStatus: order.status, newStatus: "delivered", source: "shippo_webhook", trackingNumber },
    });

    const orderUser = order.user as { name?: string; email?: string } | null;
    if (orderUser?.email) {
      sendTemplatedEmail(orderUser.email, "delivery-confirmation", {
        orderId: order.id,
        customerName: orderUser.name,
      }).catch((error) => {
        console.error(`Failed to send delivery confirmation email for order ${order.id}:`, error);
      });
    }

    return successResponse(res, { received: true, processed: true, orderId: order.id });
  } catch (error) {
    console.error("Shippo webhook error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
