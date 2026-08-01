// Brute-force / credential-stuffing protection for the auth endpoints that
// accept a password or create an account. Left off read-only/OAuth-redirect
// routes (demo-accounts list, Google entry/callback) since those don't take
// a client-supplied credential to guess.
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

// REQ-1642 — bounds abuse of the two customer-facing money-moving endpoints
// (spamming PaymentIntent creation, hammering order creation). Higher limit
// than auth since legitimate multi-item/retry checkout traffic is normal.
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment requests, please try again later" },
});
