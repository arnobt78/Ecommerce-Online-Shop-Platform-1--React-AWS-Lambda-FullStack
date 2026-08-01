// Parent: REQ-1200, REQ-1209, REQ-1210, REQ-1301
// Express app wiring — mounts every route module ported from the AWS Lambda
// backend, restricts CORS to real frontend origins (replacing the Lambda
// API Gateway's AllowOrigins: "*"), and exposes /api/health for the Docker
// HEALTHCHECK + Coolify.

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";

import { Sentry } from "./lib/sentry";
import authRoutes from "./routes/auth.routes";
import * as productsRoutes from "./routes/products.routes";
import * as ordersRoutes from "./routes/orders.routes";
import adminUsersRoutes from "./routes/adminUsers.routes";
import * as reviewsRoutes from "./routes/reviews.routes";
import ticketsRoutes from "./routes/tickets.routes";
import notificationsRoutes from "./routes/notifications.routes";
import paymentRoutes from "./routes/payment.routes";
import activityLogRoutes from "./routes/activityLog.routes";
import emailRoutes from "./routes/email.routes";
import aiInsightsRoutes from "./routes/aiInsights.routes";
import addressesRoutes from "./routes/addresses.routes";
import monitoringRoutes from "./routes/monitoring.routes";

const app = express();

// Standard security headers (HSTS, no-sniff, frame-deny, etc.). CORP is
// relaxed to cross-origin since this JSON API is intentionally consumed by a
// separate frontend origin (Vercel) — same-origin (the helmet default) is
// meant for servers that also render/serve their own page assets.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and any configured origin.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Stripe requires the RAW request body to verify webhook signatures. This must
// be registered BEFORE the global express.json() below so the body stream
// reaches Stripe's verifier unparsed for this one path (see payment.routes.ts).
app.use("/payment/webhook", express.raw({ type: "application/json" }));

// A Sentry envelope is a multi-line NDJSON-like format, not a single JSON
// object — needs the raw text body, registered before express.json() for the
// same reason as the Stripe webhook above (see monitoring.routes.ts).
app.use("/api/monitoring", express.text({ type: "*/*", limit: "300kb" }));

app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => res.status(200).json({ status: "ok" }));

app.use(authRoutes);
app.use(productsRoutes.publicRouter);
app.use(productsRoutes.adminRouter);
app.use(ordersRoutes.publicRouter);
app.use(ordersRoutes.adminRouter);
app.use(adminUsersRoutes);
app.use(reviewsRoutes.publicRouter);
app.use(reviewsRoutes.adminRouter);
app.use("/tickets", ticketsRoutes);
app.use("/notifications", notificationsRoutes);
app.use(paymentRoutes);
app.use(activityLogRoutes);
app.use(emailRoutes);
app.use(aiInsightsRoutes);
app.use(addressesRoutes);
app.use(monitoringRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

// Captures errors from any route handler above into Sentry, then calls
// next(err) so they still reach the final formatter below — must be
// registered after all routes but before any other error-handling middleware.
Sentry.setupExpressErrorHandler(app);

// Last-resort error handler — keeps error shape consistent with the rest of the API.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: err.message || "Internal server error" });
});

export default app;
