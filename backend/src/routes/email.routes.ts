// Parent: REQ-1200, REQ-1208, REQ-1301 — parity with aws-lambda/functions/email/send-email.js

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { emailTemplates, sendTemplatedEmail } from "../services/email.service";
import { getAllProducts } from "../services/products.service";

const router = express.Router();
// Matches the frontend's ADMIN_ALERT_EMAIL constant (src/services/emailService.ts) — the
// same fixed inbox every other admin-*  alert email (new order, payment failure, etc.) already goes to.
const ADMIN_ALERT_EMAIL = "arnobt78@gmail.com";

router.post("/email/send", requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, template, data } = req.body || {};
    if (!to || !template) {
      return errorResponse(res, "'to' and 'template' are required fields", 400);
    }
    if (!emailTemplates[template]) {
      return errorResponse(res, `Invalid template: ${template}`, 400);
    }

    // Security: this route is reachable by any authenticated (non-admin) user
    // for legitimate self-service flows (order confirmation/shipping/refund
    // emails to themselves, or the fixed admin alert inbox) — without this
    // check it was an open relay letting any logged-in user email arbitrary
    // templated content to any address. Admins are exempt since they legitimately
    // send on behalf of other users (e.g. resending a customer's invoice).
    if (req.user!.role !== "admin" && to !== req.user!.email && to !== ADMIN_ALERT_EMAIL) {
      return errorResponse(res, "Unauthorized: 'to' must be your own email or the admin alert address", 403);
    }

    const result = await sendTemplatedEmail(to, template, data || {});
    return successResponse(res, { message: "Email sent successfully", ...result, to, template });
  } catch (error) {
    console.error("Send email error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to send email" }, 500);
  }
});

// POST /admin/notifications/low-stock-digest — REQ-1654: consolidated rollup
// of every low/out-of-stock product in one email, admin-triggered (no cron
// job — adding a scheduler would be new infra beyond this pass's scope; this
// is a real, working digest that a scheduled job could call later trivially).
// Deliberately its own admin-only route rather than the generic, unrestricted
// /email/send above (which accepts any `to` from any authenticated user).
router.post("/admin/notifications/low-stock-digest", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const products = await getAllProducts();
    const outOfStockProducts = products.filter((p) => p.stock === 0 || (p.stock == null && !p.in_stock)).map((p) => ({ id: p.id, name: p.name }));
    const lowStockProducts = products
      .filter((p) => p.stock != null && p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 10))
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock as number, lowStockThreshold: p.lowStockThreshold ?? 10 }));

    const result = await sendTemplatedEmail(ADMIN_ALERT_EMAIL, "admin-low-stock-digest", { lowStockProducts, outOfStockProducts });
    return successResponse(res, { message: "Stock digest sent", lowStockCount: lowStockProducts.length, outOfStockCount: outOfStockProducts.length, ...result });
  } catch (error) {
    console.error("Low stock digest error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to send stock digest" }, 500);
  }
});

export default router;
