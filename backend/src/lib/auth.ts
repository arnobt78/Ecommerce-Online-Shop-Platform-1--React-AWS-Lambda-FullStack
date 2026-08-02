// Parent: REQ-1206, REQ-1301, REQ-1305
// JWT + password helpers, ported 1:1 from aws-lambda/shared/auth.js (same
// secret env var, same token shape/expiry) so existing frontend sessions and
// the exact same JWT contract keep working against the new backend.

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { errorResponse } from "./response";
import { prisma } from "./prisma";
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

// Parent: REQ-1667 — shortened from the original 7 days now that a refresh
// token exists to silently renew it; a leaked/stolen access token is now
// only usable for at most an hour instead of a full week. 1h (not something
// much shorter like 15m) is deliberately generous for a demo/portfolio app
// where a background refresh isn't wired into every single fetch call — see
// useTokenRefresh.ts on the frontend for the renewal strategy.
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export function generateToken(user: TokenSubject): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Parent: REQ-1667 — only the hash is ever persisted (never the raw token),
// so a database leak alone can't be replayed as a valid refresh token.
export async function generateRefreshToken(userId: string): Promise<string> {
  const rawToken = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash: hashRefreshToken(rawToken), expiresAt } });
  return rawToken;
}

export interface RotatedRefreshToken {
  userId: string;
  rawToken: string;
}

// Parent: REQ-1667 — rotation: the presented token is revoked and a brand
// new one issued on every successful use, never reused. A revoked token
// being presented again is the signal that the refresh chain was
// compromised (a copy of an already-used token replayed by an attacker).
export async function rotateRefreshToken(presentedRawToken: string): Promise<RotatedRefreshToken | null> {
  const tokenHash = hashRefreshToken(presentedRawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) return null;

  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const rawToken = await generateRefreshToken(existing.userId);
  return { userId: existing.userId, rawToken };
}

// Parent: REQ-1667 — called on logout so a captured refresh token can't
// silently keep minting new access tokens after the user explicitly signs out.
export async function revokeRefreshToken(presentedRawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(presentedRawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
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

// Parent: REQ-1659 — guest checkout. Unlike requireAuth, a missing/invalid
// token is not an error here: req.user is simply left undefined and the
// route itself decides what to require (an authenticated user OR a guest
// email). Never widen this to skip auth on a route that actually needs it.
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
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
