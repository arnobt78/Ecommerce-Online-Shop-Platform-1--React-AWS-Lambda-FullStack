// Parent: REQ-1200, REQ-1205, REQ-1301
// Express response helpers — same success/error JSON shape the AWS Lambda
// backend returned (shared/response.js), so the frontend needs no changes.
// CORS is handled globally by the `cors` middleware in app.ts, not per-response.

import type { Response } from "express";

export type ErrorBody = { message: string; error?: string; [key: string]: unknown };

export function successResponse<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json(data);
}

export function errorResponse(
  res: Response,
  message: string | ErrorBody,
  statusCode = 400
): Response {
  const errorBody: ErrorBody = typeof message === "string" ? { message, error: message } : message;
  return res.status(statusCode).json(errorBody);
}
