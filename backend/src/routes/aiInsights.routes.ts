// Parent: REQ-1613
import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth, requireAdmin } from "../lib/auth";
import { aiInsightsRequestSchema, getBusinessInsights, AiInsightsUnavailableError } from "../services/aiInsights.service";

const router = express.Router();

// POST /admin/ai-insights — body: { summary: string } (client-computed analytics text summary)
router.post("/admin/ai-insights", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = aiInsightsRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Invalid request body", 400);
    }

    const result = await getBusinessInsights(parsed.data.summary);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof AiInsightsUnavailableError) {
      return errorResponse(res, { message: error.message, code: error.code }, 503);
    }
    console.error("AI insights error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
