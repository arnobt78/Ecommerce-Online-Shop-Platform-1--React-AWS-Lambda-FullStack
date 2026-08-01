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
// the same { accessToken, user } shape and must populate sessionStorage identically.
function persistSession(data: AuthResponse, { defaultRole }: { defaultRole?: string } = {}): void {
  if (!data.accessToken) return;

  sessionStorage.setItem("token", JSON.stringify(data.accessToken));
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

// Logout user (clears session storage)
export function logout(): void {
  // Clear all session storage items in a specific order to prevent race conditions
  sessionStorage.removeItem("userRole"); // Clear role FIRST to prevent access issues
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("cbid");
  sessionStorage.removeItem("userEmail");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("userImage");
  // Dispatch custom event to notify components of storage change
  window.dispatchEvent(new Event("sessionStorageChange"));
}
