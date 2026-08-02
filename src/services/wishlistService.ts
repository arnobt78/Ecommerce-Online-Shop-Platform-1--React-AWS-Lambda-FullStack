/**
 * Wishlist Service - API functions for save-for-later favorites (REQ-1656)
 *
 * Pure functions - no React Query logic here.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { Product } from "../types";

export interface WishlistEntry {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product: Product;
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

export async function getWishlist(): Promise<WishlistEntry[]> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/wishlist`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function addToWishlist(productId: string): Promise<WishlistEntry> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/wishlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function removeFromWishlist(productId: string): Promise<{ message: string }> {
  const token = getToken();
  if (!token) throw new ApiError("User not authenticated", 401);

  const response = await fetch(`${API_BASE_URL}/wishlist/${productId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}
