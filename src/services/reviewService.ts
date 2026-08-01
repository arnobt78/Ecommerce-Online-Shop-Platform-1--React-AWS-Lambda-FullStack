/**
 * Review Service - Pure API Functions
 *
 * These are pure functions that make API calls to the review endpoints.
 * NO React Query logic here - just fetch calls.
 */

import type { Review } from "../types";
import { API_BASE_URL } from "../lib/apiBase";

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
    if (errorData.errorType) {
      errorMessage = `${errorMessage} (${errorData.errorType})`;
    }
  } catch {
    errorMessage = response.statusText;
  }
  return errorMessage;
}

export interface RatingStats {
  averageRating: number;
  reviewCount: number;
}

export async function getReviewsByProduct(productId: string): Promise<{ reviews: Review[]; ratingStats: RatingStats }> {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  const response = await fetch(`${API_BASE_URL}/reviews?productId=${productId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  // API returns { reviews: [...], ratingStats: {...} }
  return {
    reviews: data.reviews || [],
    ratingStats: data.ratingStats || { averageRating: 0, reviewCount: 0 },
  };
}

export interface CreateReviewInput {
  productId: string;
  orderId: string;
  rating: number;
  comment: string;
}

export async function createReview(reviewData: CreateReviewInput): Promise<Review> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(reviewData),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return data.review || data;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
}

export async function updateReview(reviewId: string, updates: UpdateReviewInput): Promise<Review> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return data.review || data;
}

export async function deleteReview(reviewId: string): Promise<{ message: string; productId: string }> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
}

export async function getAllReviews(status: string | null = null): Promise<Review[]> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const url = status ? `${API_BASE_URL}/admin/reviews?status=${status}` : `${API_BASE_URL}/admin/reviews`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return data.reviews || data;
}

export async function updateReviewStatus(reviewId: string, status: string): Promise<Review> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return data.review || data;
}

// Parent: REQ-1619 — admin review detail page.
export async function getReviewById(reviewId: string): Promise<Review> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
}

// Parent: REQ-1651 — on-demand AI sentiment/moderation-flag check, run per
// admin click, not automatically on every review (keeps LLM cost/latency
// opt-in, analyzes the review's real persisted text server-side).
export interface ReviewSentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  flagged: boolean;
  reason: string | null;
  provider: string;
}

export async function analyzeReviewSentiment(reviewId: string): Promise<ReviewSentimentResult> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}/analyze-sentiment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
}

// Parent: REQ-1619 — admin public "store response" to a review. `null` clears the reply.
export async function replyToReview(reviewId: string, adminReply: string | null): Promise<Review> {
  const token = getToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ adminReply }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return data.review || data;
}
