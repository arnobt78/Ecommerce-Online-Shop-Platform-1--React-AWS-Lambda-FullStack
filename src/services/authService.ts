/**
 * Auth Service - Direct backend API calls (Express, formerly AWS Lambda).
 *
 * Direct fetch calls for maximum speed. No wrapper overhead.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { User } from "../types";

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface DemoAccount {
  email: string;
  name: string;
  role: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

// Surfaces the backend's actual error message (e.g. "Invalid credentials")
// instead of the generic HTTP status text (e.g. "Unauthorized").
async function throwApiError(response: Response): Promise<never> {
  let message = response.statusText;
  try {
    const errorData = await response.json();
    message = errorData.message || errorData.error || response.statusText;
  } catch {
    // response body wasn't JSON — fall back to statusText
  }
  throw new ApiError(message, response.status);
}

// Shared session-bootstrap used by login/register/demoLogin — all three receive
// the same { accessToken, refreshToken, user } shape and must populate sessionStorage identically.
function persistSession(data: AuthResponse, { defaultRole }: { defaultRole?: string } = {}): void {
  if (!data.accessToken) return;

  sessionStorage.setItem("token", JSON.stringify(data.accessToken));
  // REQ-1667: the access token is now short-lived (1h) — this refresh token
  // is what useTokenRefresh.ts uses to silently renew it without forcing a
  // re-login every hour.
  if (data.refreshToken) {
    sessionStorage.setItem("refreshToken", JSON.stringify(data.refreshToken));
  }
  sessionStorage.setItem("cbid", JSON.stringify(data.user.id));
  if (data.user?.email) {
    sessionStorage.setItem("userEmail", data.user.email);
    window.dispatchEvent(new Event("sessionStorageChange"));
  }
  if (data.user?.name) {
    sessionStorage.setItem("userName", data.user.name);
  }
  if (data.user?.role) {
    sessionStorage.setItem("userRole", data.user.role);
  } else if (defaultRole) {
    sessionStorage.setItem("userRole", defaultRole);
  }
  if (data.user?.image) {
    sessionStorage.setItem("userImage", data.user.image);
  } else {
    sessionStorage.removeItem("userImage");
  }
}

export async function login(authDetail: LoginInput): Promise<AuthResponse> {
  const requestOptions: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(authDetail),
  };

  const response = await fetch(`${API_BASE_URL}/login`, requestOptions);

  if (!response.ok) {
    await throwApiError(response);
  }

  const data: AuthResponse = await response.json();
  persistSession(data);
  return data;
}

// Fetch the list of seeded demo accounts for the login page's quick-login
// dropdown. Returns { email, name, role } only — no passwords ever leave the
// server, so nothing demo-account-related needs to live in frontend env vars.
export async function getDemoAccounts(): Promise<DemoAccount[]> {
  const response = await fetch(`${API_BASE_URL}/auth/demo-accounts`);
  if (!response.ok) {
    await throwApiError(response);
  }
  const data = await response.json();
  return data.accounts || [];
}

// One-click login as a demo account picked from getDemoAccounts() — no
// password involved, the backend only allows emails already flagged isDemo.
export async function demoLogin(email: string): Promise<AuthResponse> {
  const requestOptions: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  };

  const response = await fetch(`${API_BASE_URL}/auth/demo-login`, requestOptions);

  if (!response.ok) {
    await throwApiError(response);
  }

  const data: AuthResponse = await response.json();
  persistSession(data);
  return data;
}

export async function register(authDetail: RegisterInput): Promise<AuthResponse> {
  const requestOptions: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(authDetail),
  };

  const response = await fetch(`${API_BASE_URL}/register`, requestOptions);

  if (!response.ok) {
    await throwApiError(response);
  }

  const data: AuthResponse = await response.json();
  persistSession(data, { defaultRole: "user" });

  return data;
}

function getStoredRefreshToken(): string | null {
  try {
    return JSON.parse(sessionStorage.getItem("refreshToken") || "null");
  } catch {
    return null;
  }
}

// REQ-1667 — silently exchanges the stored refresh token for a new access
// token (rotating the refresh token in the same call). Called by
// useTokenRefresh.ts on a timer/focus check, never from a user action, so it
// stays quiet on failure — the caller decides whether an expired/invalid
// refresh token should log the user out.
export async function refreshAccessToken(): Promise<AuthResponse | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;

  const data: AuthResponse = await response.json();
  persistSession(data);
  return data;
}

// Logout user (clears session storage). Also best-effort revokes the
// refresh token server-side (REQ-1667) so a captured token can't keep
// minting new access tokens after an explicit sign-out — fired without
// awaiting so logout always feels instant regardless of network conditions.
export function logout(): void {
  const refreshToken = getStoredRefreshToken();
  if (refreshToken) {
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      // Best-effort only — local session is cleared regardless below.
    });
  }

  // Clear all session storage items in a specific order to prevent race conditions
  sessionStorage.removeItem("userRole"); // Clear role FIRST to prevent access issues
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("cbid");
  sessionStorage.removeItem("userEmail");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("userImage");
  // Dispatch custom event to notify components of storage change
  window.dispatchEvent(new Event("sessionStorageChange"));
}
