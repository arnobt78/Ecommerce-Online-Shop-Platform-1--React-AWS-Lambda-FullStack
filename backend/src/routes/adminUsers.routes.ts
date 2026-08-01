// Parent: REQ-1200, REQ-1301, REQ-1304 — parity with aws-lambda/functions/admin/{users,user-detail,user-update,user-delete}.js

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logActivity } from "../services/activityLog.service";
import * as usersService from "../services/users.service";
import { updateUserSchema } from "../services/users.service";
import { getOrdersByUserId } from "../services/orders.service";
import { getAddressesByUserId } from "../services/addresses.service";

const router = express.Router();

// GET /admin/users
router.get("/admin/users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await usersService.getAllUsers();
    return successResponse(res, users);
  } catch (error) {
    console.error("Admin users list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /admin/users/:id — REQ-1618: embeds this user's order history and
// address book in the same response (avoids two extra admin-only round-trips).
router.get("/admin/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await usersService.getUserById(req.params.id!);
    if (!user) return errorResponse(res, "User not found", 404);
    const [orders, addresses] = await Promise.all([getOrdersByUserId(user.id), getAddressesByUserId(user.id)]);
    return successResponse(res, { ...user, orders, addresses });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /admin/users/:id
router.put("/admin/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id!;
    const parsed = updateUserSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid user data", 400);
    }

    const updatedUser = await usersService.updateUser(userId, parsed.data);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "update",
      entityType: "user",
      entityId: userId,
      details: { updatedFields: Object.keys(req.body || {}) },
    });

    return successResponse(res, updatedUser);
  } catch (error) {
    console.error("Admin user update error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "User not found") return errorResponse(res, message, 404);
    if (message === "Email already in use") return errorResponse(res, message, 409);
    if (message.startsWith("Invalid role")) return errorResponse(res, message, 400);
    return errorResponse(res, { message }, 500);
  }
});

// DELETE /admin/users/:id
router.delete("/admin/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id!;
    const existingUser = await usersService.getUserById(userId);
    if (!existingUser) return errorResponse(res, "User not found", 404);

    const result = await usersService.deleteUser(userId);

    logActivity({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      action: "delete",
      entityType: "user",
      entityId: userId,
      details: { deletedUserEmail: existingUser.email },
    });

    return successResponse(res, result);
  } catch (error) {
    console.error("Admin user delete error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "User not found") return errorResponse(res, message, 404);
    return errorResponse(res, { message }, 500);
  }
});

export default router;
