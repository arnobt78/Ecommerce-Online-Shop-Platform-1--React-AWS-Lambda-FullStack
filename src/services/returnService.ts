/**
 * Return/RMA Service (REQ-1663) - customer return requests + admin approve/reject.
 *
 * Pure functions - no React Query logic here.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";

export type ReturnStatus = "requested" | "approved" | "rejected" | "refunded";

export interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: ReturnStatus;
  adminNote: string | null;
  refundId: string | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
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

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function getMyReturns(): Promise<ReturnRequest[]> {
  const response = await fetch(`${API_BASE_URL}/returns`, { headers: authHeaders() });
  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function createReturnRequest(orderId: string, reason: string): Promise<ReturnRequest> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/return`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function getAllReturns(): Promise<ReturnRequest[]> {
  const response = await fetch(`${API_BASE_URL}/admin/returns`, { headers: authHeaders() });
  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function approveReturn(id: string, adminNote?: string): Promise<ReturnRequest> {
  const response = await fetch(`${API_BASE_URL}/admin/returns/${id}/approve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ adminNote }),
  });
  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}

export async function rejectReturn(id: string, adminNote?: string): Promise<ReturnRequest> {
  const response = await fetch(`${API_BASE_URL}/admin/returns/${id}/reject`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ adminNote }),
  });
  if (!response.ok) throw new ApiError(await extractErrorMessage(response), response.status);
  return response.json();
}
