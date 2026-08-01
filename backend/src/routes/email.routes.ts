// Parent: REQ-1200, REQ-1208, REQ-1301 — parity with aws-lambda/functions/email/send-email.js

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import { emailTemplates, sendTemplatedEmail } from "../services/email.service";

const router = express.Router();

router.post("/email/send", requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, template, data } = req.body || {};
    if (!to || !template) {
      return errorResponse(res, "'to' and 'template' are required fields", 400);
    }
    if (!emailTemplates[template]) {
      return errorResponse(res, `Invalid template: ${template}`, 400);
    }

    const result = await sendTemplatedEmail(to, template, data || {});
    return successResponse(res, { message: "Email sent successfully", ...result, to, template });
  } catch (error) {
    console.error("Send email error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Failed to send email" }, 500);
  }
});

export default router;
