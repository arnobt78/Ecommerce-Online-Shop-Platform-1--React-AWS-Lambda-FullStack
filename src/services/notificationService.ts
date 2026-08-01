/**
 * Notification Service - Frontend API calls for notifications
 *
 * Handles notification count retrieval and marking notifications as read.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";

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

export interface NotificationCount {
  count: number;
  orderCount: number;
  ticketCount: number;
  notificationsReadAt: string | null;
}

export async function getNotificationCount(): Promise<NotificationCount> {
  const browserData = getSession();

  if (!browserData.token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/notifications/count`, {
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

export async function markNotificationsRead(): Promise<{ notificationsReadAt: string; message: string }> {
  const browserData = getSession();

  if (!browserData.token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/notifications/mark-read`, {
    method: "POST",
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
