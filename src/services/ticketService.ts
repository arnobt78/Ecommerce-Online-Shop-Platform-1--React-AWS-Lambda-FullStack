/**
 * Ticket Service - API functions for support tickets
 *
 * This service handles all API calls related to support tickets.
 * Pure functions - no React Query logic here.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { Ticket, TicketPriority, TicketCategory } from "../types";

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

export interface CreateTicketInput {
  subject: string;
  message: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  orderId?: string;
}

export async function createTicket(ticketData: CreateTicketInput): Promise<Ticket> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(ticketData),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getTickets(): Promise<{ tickets: Ticket[] }> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getTicket(ticketId: string): Promise<Ticket> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const data = await response.json();
  // API returns ticket object directly (not wrapped in { ticket: ... })
  return data.ticket || data;
}

export async function replyToTicket(ticketId: string, message: string): Promise<Ticket> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<Ticket> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

// REQ-1666 — on-demand AI reply draft, admin only. Never auto-sent; the
// admin reviews/edits the returned text before submitting via replyToTicket.
export interface TicketReplyDraftResult {
  draft: string;
  provider: string;
}

export async function generateTicketReplyDraft(ticketId: string): Promise<TicketReplyDraftResult> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/generate-reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateTicketPriority(ticketId: string, priority: TicketPriority): Promise<Ticket> {
  const token = getToken();

  if (!token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/priority`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ priority }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}
