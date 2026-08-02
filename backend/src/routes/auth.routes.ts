// Parent: REQ-1200 (login/register parity), REQ-1500-1505 (Google sign-in), REQ-1301, REQ-1304

import express, { type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { successResponse, errorResponse } from "../lib/response";
import { generateToken, generateRefreshToken, rotateRefreshToken, revokeRefreshToken } from "../lib/auth";
import { authLimiter } from "../lib/rateLimit";
import { getGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserInfo } from "../lib/googleOAuth";
import * as usersService from "../services/users.service";
import { registerSchema } from "../services/users.service";

const router = express.Router();

const OAUTH_STATE_COOKIE = "google_oauth_state";

// Minimal manual cookie parse — no cookie-parser dependency for a single read site.
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : null;
}

// POST /login — parity with aws-lambda/functions/auth/login.js
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }

    const user = await usersService.verifyUser(email, password);
    if (!user) {
      return errorResponse(res, "Invalid credentials", 401);
    }

    const accessToken = generateToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    return successResponse(res, { accessToken, refreshToken, user });
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /register — parity with aws-lambda/functions/auth/register.js
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, parsed.error.issues[0]?.message || "Email, password, and name are required", 400);
    }

    const user = await usersService.createUser(parsed.data);
    const accessToken = generateToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    return successResponse(res, { accessToken, refreshToken, user });
  } catch (error) {
    console.error("Register error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "User already exists") {
      return errorResponse(res, "User already exists", 409);
    }
    return errorResponse(res, { message }, 500);
  }
});

// GET /auth/demo-accounts — REQ-1510. Public, password-free list of seeded demo
// accounts for the login page's quick-login dropdown. No credentials ever leave
// the server or live in the frontend bundle/env.
router.get("/auth/demo-accounts", async (_req: Request, res: Response) => {
  try {
    const accounts = await usersService.getDemoAccounts();
    return successResponse(res, { accounts });
  } catch (error) {
    console.error("Get demo accounts error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /auth/demo-login — REQ-1510. Issues a real JWT for a demo account picked
// from the vetted list above — no password round trip needed or possible.
router.post("/auth/demo-login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return errorResponse(res, "Email is required", 400);
    }

    const user = await usersService.demoLogin(email);
    if (!user) {
      return errorResponse(res, "Not a demo account", 403);
    }

    const accessToken = generateToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    return successResponse(res, { accessToken, refreshToken, user });
  } catch (error) {
    console.error("Demo login error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /auth/google — REQ-1500-1502. Redirects to Google's consent screen.
// A short-lived, single-use `state` value is round-tripped (via an httpOnly cookie,
// not just the URL) and checked on callback below to prevent CSRF.
router.get("/auth/google", (_req: Request, res: Response) => {
  const state = randomUUID();
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 5 * 60 * 1000, // 5 minutes — the whole consent round trip should take seconds
  });
  res.redirect(getGoogleAuthUrl(state));
});

// GET /auth/google/callback — REQ-1502, REQ-1503. Exchanges the code, finds/creates
// the user, issues our own JWT, and redirects to the frontend callback route with it
// (mirrors the pattern already used on the user's other Coolify-hosted projects).
router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
  res.clearCookie(OAUTH_STATE_COOKIE);

  try {
    const { code, state, error: googleError } = req.query;
    if (googleError) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(String(googleError))}`);
    }
    if (!code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=missing_code`);
    }

    const expectedState = readCookie(req, OAUTH_STATE_COOKIE);
    if (!expectedState || expectedState !== state) {
      return res.redirect(`${frontendUrl}/auth/callback?error=invalid_state`);
    }

    const tokens = await exchangeCodeForTokens(String(code));
    const profile = await getGoogleUserInfo(tokens.access_token);

    if (!profile.email) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_email`);
    }

    const user = await usersService.findOrCreateGoogleUser(profile);
    const accessToken = generateToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    // Tokens travel via URL fragment (#) rather than query string so they
    // never hit server logs / the browser's Referer header on the frontend route.
    return res.redirect(
      `${frontendUrl}/auth/callback#token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&user=${encodeURIComponent(JSON.stringify(user))}`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return res.redirect(`${frontendUrl}/auth/callback?error=oauth_failed`);
  }
});

// POST /auth/refresh — REQ-1667. Exchanges a still-valid refresh token for a
// new short-lived access token, rotating the refresh token in the same call
// (the old one is revoked, a new one issued) so a stolen-and-replayed old
// token is detectable. Rate-limited like the other credential-adjacent auth
// routes even though a refresh token isn't a password — it's still a bearer
// credential worth throttling guesses against.
router.post("/auth/refresh", authLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = (req.body || {}) as { refreshToken?: unknown };
    if (!refreshToken || typeof refreshToken !== "string") {
      return errorResponse(res, "refreshToken is required", 400);
    }

    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) {
      return errorResponse(res, "Invalid or expired refresh token", 401);
    }

    const user = await usersService.getUserById(rotated.userId);
    if (!user) {
      return errorResponse(res, "Invalid or expired refresh token", 401);
    }

    const accessToken = generateToken(user);
    return successResponse(res, { accessToken, refreshToken: rotated.rawToken, user });
  } catch (error) {
    console.error("Refresh token error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /auth/logout — REQ-1667. Best-effort server-side revocation so a
// captured refresh token can't keep minting new access tokens after the
// user explicitly signs out. No auth required — the refresh token itself is
// the credential being revoked, and a missing/already-invalid token is a
// harmless no-op (the client clears its own local session regardless).
router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = (req.body || {}) as { refreshToken?: unknown };
    if (refreshToken && typeof refreshToken === "string") {
      await revokeRefreshToken(refreshToken);
    }
    return successResponse(res, { message: "Logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

export default router;
