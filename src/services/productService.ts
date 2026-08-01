/**
 * Product Service - Direct backend API calls.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { Product } from "../types";

export async function getProductList(searchTerm?: string): Promise<Product[]> {
  const url = searchTerm ? `${API_BASE_URL}/products?name_like=${encodeURIComponent(searchTerm)}` : `${API_BASE_URL}/products`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }

  return response.json();
}

export async function getProduct(id: string): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);

  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }

  return response.json();
}
