// Parent: REQ-1656 — wishlist/favorites. All routes scoped to the
// authenticated user via req.user.id, never a client-supplied userId.

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import * as wishlistService from "../services/wishlist.service";

const router = express.Router();

router.use(requireAuth);

// GET /wishlist
router.get("/wishlist", async (req: Request, res: Response) => {
  try {
    const wishlist = await wishlistService.getWishlistByUserId(req.user!.id);
    return successResponse(res, wishlist);
  } catch (error) {
    console.error("Get wishlist error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /wishlist { productId }
router.post("/wishlist", async (req: Request, res: Response) => {
  try {
    const { productId } = (req.body || {}) as { productId?: unknown };
    if (!productId || typeof productId !== "string") {
      return errorResponse(res, "productId is required", 400);
    }
    const entry = await wishlistService.addToWishlist(req.user!.id, productId);
    return successResponse(res, entry, 201);
  } catch (error) {
    console.error("Add to wishlist error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Product not found") return errorResponse(res, message, 404);
    return errorResponse(res, { message }, 500);
  }
});

// DELETE /wishlist/:productId
router.delete("/wishlist/:productId", async (req: Request, res: Response) => {
  try {
    await wishlistService.removeFromWishlist(req.user!.id, req.params.productId!);
    return successResponse(res, { message: "Removed from wishlist" });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
