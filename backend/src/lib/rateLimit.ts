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
