/**
 * REQ-1667 — silent access-token renewal.
 *
 * The access token is now short-lived (1h, down from 7d) so a leaked token
 * has a much smaller blast radius. Rather than retrofitting a 401-retry
 * interceptor into every one of this codebase's ~15 raw-fetch service
 * files (a large, risky change for this pass), this hook proactively
 * refreshes the token in the background — on mount, on tab focus/visibility
 * change, and on a 5-minute safety-net interval for a long-foregrounded tab
 * — well before it actually expires, so an active session effectively never
 * hits an expired-token error in normal use. Mounted once at the App root.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { refreshAccessToken, logout } from "../services/authService";

// Refresh once the token is within this window of expiring, not only after
// it's already dead — a proactive renewal, not a reactive recovery.
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const SAFETY_NET_INTERVAL_MS = 5 * 60 * 1000;

function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function useTokenRefresh(): void {
  const navigate = useNavigate();
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAndRefresh() {
      if (isRefreshingRef.current) return; // already in flight — the interval/focus/mount checks can overlap

      let token: string | null = null;
      try {
        token = JSON.parse(sessionStorage.getItem("token") || "null");
      } catch {
        token = null;
      }
      if (!token) return; // not logged in — nothing to refresh

      const expiresAtMs = decodeJwtExpiryMs(token);
      if (expiresAtMs === null) return;

      const msUntilExpiry = expiresAtMs - Date.now();
      if (msUntilExpiry > REFRESH_MARGIN_MS) return; // still comfortably valid

      isRefreshingRef.current = true;
      try {
        const result = await refreshAccessToken();
        if (cancelled) return;

        // Refresh failed AND the access token is already past expiry — the
        // session is genuinely dead (revoked/expired refresh token), not
        // just "not due for renewal yet". Log out cleanly instead of
        // leaving a session the rest of the app can't tell is broken.
        if (!result && msUntilExpiry <= 0) {
          logout();
          navigate("/login");
        }
      } finally {
        isRefreshingRef.current = false;
      }
    }

    checkAndRefresh();
    const intervalId = window.setInterval(checkAndRefresh, SAFETY_NET_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkAndRefresh();
    };
    window.addEventListener("focus", checkAndRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkAndRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [navigate]); // navigate is a stable reference from React Router, so this effectively still runs once
}
