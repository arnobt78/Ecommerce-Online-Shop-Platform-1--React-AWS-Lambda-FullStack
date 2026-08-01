/**
 * Address Service - API functions for the customer address book (REQ-1618)
 *
 * Pure functions - no React Query logic here.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { Address } from "../types";

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

export interface AddressInput {
  label?: string;
  fullName: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
}

export async function getAddresses(): Promise<Address[]> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/addresses`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateAddress(addressId: string, input: Partial<AddressInput>): Promise<Address> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/addresses/${addressId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function deleteAddress(addressId: string): Promise<{ message: string; id: string }> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/addresses/${addressId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}
