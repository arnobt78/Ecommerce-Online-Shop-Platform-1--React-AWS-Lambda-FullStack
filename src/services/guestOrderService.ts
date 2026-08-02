/**
 * Guest Order Service - no-auth order lookup by id + email (REQ-1659)
 *
 * Pure function - no React Query logic here.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { Order, ActivityLog } from "../types";

export interface GuestOrderResult extends Order {
  timeline: ActivityLog[];
}

export async function getGuestOrder(orderId: string, email: string): Promise<GuestOrderResult> {
  const response = await fetch(`${API_BASE_URL}/orders/guest/${orderId}?email=${encodeURIComponent(email)}`);

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
