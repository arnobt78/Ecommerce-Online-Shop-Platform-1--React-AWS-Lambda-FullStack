/**
 * Payment Service - Stripe Payment Integration
 *
 * Handles Stripe payment operations including payment intent creation
 * and payment status verification.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { CartItem } from "../types";

interface Session {
  token: string | null;
  cbid: string | null;
}

function getSession(): Session {
  try {
    const token = JSON.parse(sessionStorage.getItem("token") || "null");
    const cbid = JSON.parse(sessionStorage.getItem("cbid") || "null");
    return { token, cbid };
  } catch {
    return { token: null, cbid: null };
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  let errorMessage = response.statusText;
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || response.statusText;
  } catch {
    errorMessage = response.statusText;
  }
  return errorMessage;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
  // REQ-1659: the identity (real or synthetic guest id) this payment intent
  // was created under — reused as-is by createOrder() below.
  userId: string;
  isGuest: boolean;
  // REQ-1658: present only when a coupon was applied — the server's own
  // recomputed discount, never a client-trusted figure.
  couponCode?: string;
  discountAmount?: number;
}

// REQ-1659: `guestEmail` enables checkout with no account at all — omit the
// Authorization header entirely when there's no session token so the
// backend's optionalAuth treats this as a guest request.
export async function createPaymentIntent(cartList: CartItem[], couponCode?: string, guestEmail?: string): Promise<PaymentIntentResult> {
  const browserData = getSession();

  if (!browserData.cbid && !guestEmail) {
    throw new ApiError("User not authenticated", 401);
  }

  // Only product id + quantity are sent — the backend looks up live prices
  // and recomputes the charge total itself (never trusts a client amount),
  // and derives the user identity from the auth token, not the request body.
  const requestBody = {
    currency: "usd",
    cartList: cartList.map((item) => ({ id: item.id, quantity: item.quantity })),
    ...(couponCode && { couponCode }),
    ...(!browserData.token && guestEmail && { guestEmail }),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (browserData.token) headers.Authorization = `Bearer ${browserData.token}`;

  const response = await fetch(`${API_BASE_URL}/payment/create-intent`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export interface PaymentStatus {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

export async function verifyPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
  const browserData = getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (browserData.token) headers.Authorization = `Bearer ${browserData.token}`;

  const response = await fetch(`${API_BASE_URL}/payment/verify/${paymentIntentId}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}
