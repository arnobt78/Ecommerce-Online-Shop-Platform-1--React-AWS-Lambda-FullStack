// Parent: REQ-1202, REQ-1205, REQ-1301
// Ported from aws-lambda/shared/activityLog.js. Logging failures are
// swallowed (non-critical, must never break the calling operation) — same
// contract as the AWS backend.

import type { ActivityLog, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface LogActivityInput {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export async function logActivity({
  userId,
  userEmail,
  userName,
  action,
  entityType,
  entityId,
  details = {},
}: LogActivityInput): Promise<ActivityLog | null> {
  if (!userId || !action || !entityType || !entityId) {
    console.warn("Activity log: missing required fields", { userId, action, entityType, entityId });
    return null;
  }

  try {
    return await prisma.activityLog.create({
      data: {
        userId,
        userEmail: userEmail || null,
        userName: userName || null,
        action,
        entityType,
        entityId,
        details: details as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error instanceof Error ? error.message : error);
    return null;
  }
}

interface GetActivityLogsFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  limit?: number;
}

export async function getAllActivityLogs({
  entityType,
  entityId,
  action,
  userId,
  limit = 100,
}: GetActivityLogsFilters = {}): Promise<ActivityLog[]> {
  return prisma.activityLog.findMany({
    where: {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(action && { action }),
      ...(userId && { userId }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// REQ-1617: chronological (oldest-first) timeline for a single order — used by
// the customer-facing order detail page's status-history view. Reuses the
// activity log already written by every status/tracking/label/refund route
// (orders.routes.ts) instead of a separate order-history table.
export async function getOrderActivityTimeline(orderId: string): Promise<ActivityLog[]> {
  const logs = await getAllActivityLogs({ entityType: "order", entityId: orderId, limit: 50 });
  return logs.reverse();
}
