// Sentry tunnel endpoint — the browser SDK is configured (src/lib/sentry.ts)
// to POST error envelopes here instead of directly to *.ingest.sentry.io,
// which ad-blockers/privacy extensions commonly block by domain even in a
// normal (non-incognito) browser. Requests here look like an ordinary
// same-origin API call, so they're never blocked; this route just forwards
// the raw envelope to Sentry's real ingest endpoint server-side.
// https://docs.sentry.io/platforms/javascript/troubleshooting/#dealing-with-ad-blockers
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Generous but bounded — legitimate error reporting can burst (e.g. a bad
// deploy throwing on every page load), but this must not become an open relay.
const monitoringLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/monitoring", monitoringLimiter, async (req: Request, res: Response) => {
  try {
    const envelope = typeof req.body === "string" ? req.body : "";
    if (!envelope) return res.status(400).end();

    // The envelope's first line is a JSON header containing the `dsn` the
    // SDK was initialized with — used to derive where to forward it, rather
    // than hardcoding the project/host here.
    const headerLine = envelope.split("\n")[0] ?? "";
    const header = JSON.parse(headerLine) as { dsn?: string };
    if (!header.dsn) return res.status(400).end();

    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace(/^\//, "");
    const ingestUrl = `https://${dsn.host}/api/${projectId}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;

    const sentryResponse = await fetch(ingestUrl, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
    });

    return res.status(sentryResponse.status).end();
  } catch (error) {
    console.error("Sentry tunnel forwarding error:", error);
    // Never let a monitoring-pipeline failure surface as a real API error —
    // the caller (Sentry SDK) doesn't do anything useful with a non-2xx here.
    return res.status(200).end();
  }
});

export default router;
