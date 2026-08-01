// Sentry error-monitoring init (frontend). `tunnel` routes every browser
// error report through our own backend (backend/src/routes/monitoring.routes.ts,
// POST /api/monitoring) instead of directly to *.ingest.sentry.io — that
// domain is commonly blocked by ad-blockers/privacy extensions even in a
// normal (non-incognito) browser, silently dropping error reports. Tunneled
// requests look like an ordinary same-app API call, so they aren't blocked.
import * as Sentry from "@sentry/react";
import { API_BASE_URL } from "./apiBase";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // no-op locally when not configured — never throws

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,
    tunnel: `${API_BASE_URL}/api/monitoring`,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
