// Parent: REQ-1663 — customer-initiated post-delivery return request, admin
// approve/reject. Customer routes ownership-checked via req.user.id; admin
// routes gated by requireAdmin.

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logActivity } from "../services/activityLog.service";
import * as returnsService from "../services/returns.service";
import { createReturnRequestSchema } from "../services/returns.service";

export const publicRouter = express.Router();
export const adminRouter = express.Router();

// GET /returns — the authenticated customer's own return requests
publicRouter.get("/returns", requireAuth, async (req: Request, res: Response) => {
  try {
    const returns = await returnsService.getReturnRequestsByUserId(req.user!.id);
    return successResponse(res, returns);
  } catch (error) {
    console.error("List returns error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /orders/:orderId/return — customer requests a return for a delivered order
publicRouter.post("/orders/:orderId/return", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createReturnRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid request", 400);
    }

    const returnRequest = await returnsService.createReturnRequest(req.user!.id, req.params.orderId!, parsed.data.reason);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "create",
      entityType: "order",
      entityId: req.params.orderId!,
      details: { returnRequestId: returnRequest.id, reason: parsed.data.reason },
    });

    return successResponse(res, returnRequest, 201);
  } catch (error) {
    console.error("Create return request error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Order not found") return errorResponse(res, message, 404);
    if (message.startsWith("Unauthorized")) return errorResponse(res, message, 403);
    return errorResponse(res, message, 400);
  }
});

// GET /admin/returns — all return requests, for admin triage
adminRouter.get("/admin/returns", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const returns = await returnsService.getAllReturnRequests();
    return successResponse(res, returns);
  } catch (error) {
    console.error("Admin list returns error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /admin/returns/:id/approve — issues a real Stripe refund (refundOrderPayment)
adminRouter.post("/admin/returns/:id/approve", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { adminNote } = (req.body || {}) as { adminNote?: unknown };
    const result = await returnsService.approveReturnRequest(req.params.id!, typeof adminNote === "string" ? adminNote : undefined);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: result.returnRequest.orderId,
      details: { returnRequestId: result.returnRequest.id, newStatus: "refunded", refundId: result.refundId, refundAmount: result.refundAmount },
    });

    return successResponse(res, result.returnRequest);
  } catch (error) {
    console.error("Approve return request error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Return request not found") return errorResponse(res, message, 404);
    return errorResponse(res, message, 400);
  }
});

// POST /admin/returns/:id/reject
adminRouter.post("/admin/returns/:id/reject", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { adminNote } = (req.body || {}) as { adminNote?: unknown };
    const returnRequest = await returnsService.rejectReturnRequest(req.params.id!, typeof adminNote === "string" ? adminNote : undefined);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "status_change",
      entityType: "order",
      entityId: returnRequest.orderId,
      details: { returnRequestId: returnRequest.id, newStatus: "rejected" },
    });

    return successResponse(res, returnRequest);
  } catch (error) {
    console.error("Reject return request error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Return request not found") return errorResponse(res, message, 404);
    return errorResponse(res, message, 400);
  }
});
