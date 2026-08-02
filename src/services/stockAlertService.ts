/**
 * Stock Alert Service - "Notify me" back-in-stock subscription (REQ-1657)
 *
 * Pure functions - no React Query logic here. No auth required (works for
 * a bare email subscription), but the Authorization header is attached when
 * a session exists so the subscription links to that account.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";

function getToken(): string | null {
  try {
    return JSON.parse(sessionStorage.getItem("token") || "null");
  } catch {
    return null;
  }
}

export async function subscribeToStockAlert(productId: string, email: string): Promise<{ message: string }> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/stock-alerts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ productId, email }),
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || response.statusText;
    } catch {
      // response body wasn't JSON — fall back to statusText
    }
    throw new ApiError(message, response.status);
  }

  return response.json();
}
