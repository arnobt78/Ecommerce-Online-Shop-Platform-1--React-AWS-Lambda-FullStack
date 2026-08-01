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
}

interface PaymentUser {
  id?: string;
  email?: string;
  name?: string;
}

export async function createPaymentIntent(amount: number, cartList: CartItem[], user: PaymentUser): Promise<PaymentIntentResult> {
  const browserData = getSession();

  if (!browserData.cbid) {
    throw new ApiError("User not authenticated", 401);
  }

  // Convert amount to cents (Stripe uses cents)
  const amountInCents = Math.round(amount * 100);

  const requestBody = {
    amount: amountInCents,
    currency: "usd",
    metadata: {
      userId: user.id || browserData.cbid,
      userEmail: user.email,
      userName: user.name || "Guest",
      itemCount: cartList.length,
    },
  };

  const response = await fetch(`${API_BASE_URL}/payment/create-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${browserData.token}`,
    },
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

  if (!browserData.cbid) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/payment/verify/${paymentIntentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${browserData.token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}
