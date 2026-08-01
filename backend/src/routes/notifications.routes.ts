// Parent: REQ-1200, REQ-1301 — parity with aws-lambda/functions/notifications/*.js
// Mounted at /notifications in app.ts — routes below are relative to that
// prefix so `router.use(requireAuth)` only scopes /notifications* requests.

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import { getUserById, updateUser } from "../services/users.service";
import { getNotificationSummary } from "../services/notifications.service";

const router = express.Router();

router.use(requireAuth);

// GET /notifications/count
router.get("/count", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);

    const summary = await getNotificationSummary(user);
    return successResponse(res, summary);
  } catch (error) {
    console.error("Notification count error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /notifications/mark-read
router.post("/mark-read", async (req: Request, res: Response) => {
  try {
    const notificationsReadAt = new Date().toISOString();
    const updatedUser = await updateUser(req.user!.id, { notificationsReadAt });
    return successResponse(res, {
      notificationsReadAt: updatedUser.notificationsReadAt || notificationsReadAt,
      message: "Notifications marked as read",
    });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "User not found") return errorResponse(res, message, 404);
    return errorResponse(res, { message }, 500);
  }
});

export default router;
