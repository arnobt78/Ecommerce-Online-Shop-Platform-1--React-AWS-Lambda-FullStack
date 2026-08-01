// Parent: REQ-1618 — self-service address book routes, mounted at /addresses
// (see app.ts). Ownership is always derived from req.user (JWT), never from
// a client-supplied userId, so one user can never read/edit another's addresses.

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import * as addressesService from "../services/addresses.service";
import { addressInputSchema, updateAddressSchema } from "../services/addresses.service";

const router = express.Router();

router.get("/addresses", requireAuth, async (req: Request, res: Response) => {
  try {
    const addresses = await addressesService.getAddressesByUserId(req.user!.id);
    return successResponse(res, addresses);
  } catch (error) {
    console.error("Addresses list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

router.post("/addresses", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = addressInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid address data", 400);
    }
    const address = await addressesService.createAddress(req.user!.id, parsed.data);
    return successResponse(res, address, 201);
  } catch (error) {
    console.error("Address create error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

router.put("/addresses/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateAddressSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid address data", 400);
    }
    const address = await addressesService.updateAddress(req.user!.id, req.params.id!, parsed.data);
    return successResponse(res, address);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Address not found") return errorResponse(res, message, 404);
    console.error("Address update error:", error);
    return errorResponse(res, { message }, 500);
  }
});

router.delete("/addresses/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressesService.deleteAddress(req.user!.id, req.params.id!);
    return successResponse(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Address not found") return errorResponse(res, message, 404);
    console.error("Address delete error:", error);
    return errorResponse(res, { message }, 500);
  }
});

export default router;
