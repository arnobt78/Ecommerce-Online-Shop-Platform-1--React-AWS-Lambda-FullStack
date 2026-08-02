// Parent: REQ-1658 — checkout discount codes. Public validate route (works
// for both authenticated and guest checkout, REQ-1659) + admin-only CRUD.

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { paymentLimiter } from "../lib/rateLimit";
import * as couponsService from "../services/coupons.service";
import { createCouponSchema, updateCouponSchema } from "../services/coupons.service";

export const publicRouter = express.Router();
export const adminRouter = express.Router();

// POST /coupons/validate { code, subtotalCents } — rate-limited (shares
// paymentLimiter with the checkout routes) since an unrestricted endpoint
// that echoes back "valid"/"invalid" is otherwise a code-enumeration vector.
publicRouter.post("/coupons/validate", paymentLimiter, async (req: Request, res: Response) => {
  try {
    const { code, subtotalCents } = (req.body || {}) as { code?: unknown; subtotalCents?: unknown };
    if (!code || typeof code !== "string") return errorResponse(res, "Coupon code is required", 400);
    if (typeof subtotalCents !== "number" || subtotalCents <= 0) return errorResponse(res, "A valid subtotal is required", 400);

    const { coupon, discountAmountCents } = await couponsService.validateAndApplyCoupon(code, subtotalCents);
    return successResponse(res, {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountAmountCents,
    });
  } catch (error) {
    return errorResponse(res, { message: error instanceof Error ? error.message : "Invalid coupon code" }, 400);
  }
});

adminRouter.get("/admin/coupons", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const coupons = await couponsService.getAllCoupons();
    return successResponse(res, coupons);
  } catch (error) {
    console.error("List coupons error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

adminRouter.post("/admin/coupons", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createCouponSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, parsed.error.issues[0]?.message || "Invalid coupon data", 400);

    const coupon = await couponsService.createCoupon(parsed.data);
    return successResponse(res, coupon, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Unique constraint")) return errorResponse(res, "A coupon with this code already exists", 409);
    return errorResponse(res, { message }, 500);
  }
});

adminRouter.put("/admin/coupons/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = updateCouponSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, parsed.error.issues[0]?.message || "Invalid coupon data", 400);

    const coupon = await couponsService.updateCoupon(req.params.id!, parsed.data);
    return successResponse(res, coupon);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Coupon not found") return errorResponse(res, message, 404);
    if (message.includes("Unique constraint")) return errorResponse(res, "A coupon with this code already exists", 409);
    return errorResponse(res, { message }, 500);
  }
});

adminRouter.delete("/admin/coupons/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await couponsService.deleteCoupon(req.params.id!);
    return successResponse(res, { message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Delete coupon error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
