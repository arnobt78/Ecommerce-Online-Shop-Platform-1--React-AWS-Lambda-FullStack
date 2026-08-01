// Parent: REQ-1206, REQ-1301, REQ-1305
// JWT + password helpers, ported 1:1 from aws-lambda/shared/auth.js (same
// secret env var, same token shape/expiry) so existing frontend sessions and
// the exact same JWT contract keep working against the new backend.

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { errorResponse } from "./response";
import type { AuthUser } from "../types/auth";

const INSECURE_DEFAULT_SECRETS = ["your-secret-key-change-in-production", "change-me-to-a-long-random-string"];

// Fail fast rather than silently signing tokens with a guessable secret.
// Generate a real one with: openssl rand -base64 64
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_SECRET))
) {
  throw new Error(
    "JWT_SECRET is missing, too short, or still set to a known placeholder. " +
      "Set a real secret (>=32 chars, e.g. `openssl rand -base64 64`) before starting in production."
  );
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Minimal shape every caller passes in (Prisma User rows have more fields,
// but the token only ever needs to carry these four).
interface TokenSubject {
  id: string;
  email: string;
  name: string | null;
  role?: string | null;
}

export function generateToken(user: TokenSubject): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false; // Google-only accounts have no password hash
  return bcrypt.compare(password, hash);
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization || (req.headers as Record<string, string>).Authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] ?? null;
}

// Express middleware: rejects with 401 if no valid Bearer token, otherwise
// attaches the decoded token payload to req.user (same shape as the AWS
// Lambda `requireAuth(event)` decoded token: { id, email, name, role }).
export function requireAuth(req: Request, res: Response, next: NextFunction): void | Response {
  const token = extractToken(req);
  if (!token) return errorResponse(res, "Unauthorized", 401);

  const decoded = verifyToken(token);
  if (!decoded) return errorResponse(res, "Unauthorized", 401);

  req.user = decoded;
  next();
}

// Express middleware: must run after requireAuth. Mirrors the
// `if (decoded.role !== "admin")` checks scattered across the admin Lambda handlers.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void | Response {
  if (!req.user || req.user.role !== "admin") {
    return errorResponse(res, "Admin access required", 403);
  }
  next();
}
