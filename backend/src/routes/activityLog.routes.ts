// Parent: REQ-1200, REQ-1301 — parity with aws-lambda/functions/admin/activity-logs.js

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getAllActivityLogs } from "../services/activityLog.service";

const router = express.Router();

router.get("/admin/activity-logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { entityType, action, userId, limit } = req.query;
    const logs = await getAllActivityLogs({
      entityType: entityType ? String(entityType) : undefined,
      action: action ? String(action) : undefined,
      userId: userId ? String(userId) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return successResponse(res, logs);
  } catch (error) {
    console.error("Activity logs error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
