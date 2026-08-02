// Parent: REQ-1657 — "Notify me" back-in-stock subscription. Public (no auth
// required) since a shopper browsing without an account should still be able
// to subscribe with just an email — same reasoning as a newsletter signup.

import express, { type Request, type Response } from "express";
import { z } from "zod";
import { successResponse, errorResponse } from "../lib/response";
import { verifyToken } from "../lib/auth";
import { publicWriteLimiter } from "../lib/rateLimit";
import * as stockAlertService from "../services/stockAlert.service";

const router = express.Router();

const subscribeSchema = z.object({
  productId: z.string().min(1),
  email: z.string().email(),
});

// POST /stock-alerts — optionally authenticated: if a valid Bearer token is
// present, the subscription is linked to that userId; otherwise it's a bare
// email subscription (no account required).
router.post("/stock-alerts", publicWriteLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid request", 400);
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const decoded = token ? verifyToken(token) : null;

    await stockAlertService.subscribeToStockAlert(parsed.data.productId, parsed.data.email, decoded?.id || null);
    return successResponse(res, { message: "You'll be notified when this product is back in stock." }, 201);
  } catch (error) {
    console.error("Stock alert subscribe error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Product not found") return errorResponse(res, message, 404);
    return errorResponse(res, { message }, 500);
  }
});

export default router;
