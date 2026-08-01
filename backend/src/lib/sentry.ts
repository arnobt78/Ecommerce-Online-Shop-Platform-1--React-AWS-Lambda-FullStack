// Sentry error-monitoring init — imported first in server.ts (after
// dotenv/config) so startup/import-time errors are captured too. If
// SENTRY_DSN is unset (e.g. local dev without it configured), Sentry.init
// no-ops safely per the SDK's own documented behavior — every Sentry.* call
// becomes a harmless no-op rather than throwing.
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  // Modest trace sampling — this is error monitoring, not full APM; keep
  // ingest volume low rather than tracing every request.
  tracesSampleRate: 0.1,
});

export { Sentry };
