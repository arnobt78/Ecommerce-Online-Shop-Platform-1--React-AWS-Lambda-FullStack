/**
 * Coupon Service - Checkout discount codes (REQ-1658)
 *
 * Pure functions - no React Query logic here.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  timesUsed: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidationResult {
  code: string;
  type: "percent" | "fixed";
  value: number;
  discountAmountCents: number;
}

export interface CreateCouponInput {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  expiresAt?: string | null;
  active?: boolean;
}

function getToken(): string | null {
  try {
    return JSON.parse(sessionStorage.getItem("token") || "null");
  } catch {
    return null;
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

// Public — works during guest checkout too (REQ-1659), no auth required.
export async function validateCoupon(code: string, subtotalCents: number): Promise<CouponValidationResult> {
  const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotalCents }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getAllCoupons(): Promise<Coupon[]> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/admin/coupons`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/admin/coupons`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function updateCoupon(id: string, input: Partial<CreateCouponInput>): Promise<Coupon> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function deleteCoupon(id: string): Promise<{ message: string }> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}
