// Parent: REQ-1663 — customer-initiated post-delivery return request, with
// admin approve/reject. Approval reuses refundOrderPayment() (REQ-1639) —
// the exact same Stripe flow as a direct admin refund, not a parallel one.

import { z } from "zod";
import type { ReturnRequest } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getOrderById, refundOrderPayment } from "./orders.service";

export const createReturnRequestSchema = z.object({
  reason: z.string().min(10, "Please describe the reason for your return (at least 10 characters)").max(1000),
});
export type CreateReturnRequestInput = z.infer<typeof createReturnRequestSchema>;

// Time-boxed to 30 days after delivery — matches the storefront FAQ's stated
// return window (no digital-download refund abuse from a years-old order).
const RETURN_WINDOW_DAYS = 30;

export async function createReturnRequest(userId: string, orderId: string, reason: string): Promise<ReturnRequest> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.userId !== userId) throw new Error("Unauthorized: this order does not belong to you");
  if (order.status !== "delivered") throw new Error("Only delivered orders can be returned");

  const deliveredAt = order.updatedAt; // status transitions update `updatedAt`; no separate deliveredAt column
  const windowEnd = new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (new Date() > windowEnd) {
    throw new Error(`The ${RETURN_WINDOW_DAYS}-day return window for this order has passed`);
  }

  const existing = await prisma.returnRequest.findFirst({ where: { orderId, status: { in: ["requested", "approved"] } } });
  if (existing) throw new Error("A return request already exists for this order");

  return prisma.returnRequest.create({ data: { orderId, userId, reason, status: "requested" } });
}

export async function getReturnRequestsByUserId(userId: string): Promise<ReturnRequest[]> {
  return prisma.returnRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getAllReturnRequests(): Promise<ReturnRequest[]> {
  return prisma.returnRequest.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getReturnRequestById(id: string): Promise<ReturnRequest | null> {
  return prisma.returnRequest.findUnique({ where: { id } });
}

export interface ApproveReturnResult {
  returnRequest: ReturnRequest;
  refundId: string;
  refundAmount: number;
}

// Parent: REQ-1663 — approve issues a real Stripe refund via the shared
// refundOrderPayment() helper (same flow as REQ-1639's cancel-and-refund and
// the admin's direct "Process Refund" action), then marks the return
// "refunded" in one step rather than a separate manual follow-up.
export async function approveReturnRequest(id: string, adminNote?: string): Promise<ApproveReturnResult> {
  const returnRequest = await getReturnRequestById(id);
  if (!returnRequest) throw new Error("Return request not found");
  if (returnRequest.status !== "requested") throw new Error(`Cannot approve a return request with status "${returnRequest.status}"`);

  const order = await getOrderById(returnRequest.orderId);
  if (!order) throw new Error("Order not found");

  const { refund } = await refundOrderPayment(order, { reason: "requested_by_customer" });

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: "refunded", adminNote: adminNote || null, refundId: refund.id, refundAmount: refund.amount },
  });

  return { returnRequest: updated, refundId: refund.id, refundAmount: refund.amount };
}

export async function rejectReturnRequest(id: string, adminNote?: string): Promise<ReturnRequest> {
  const returnRequest = await getReturnRequestById(id);
  if (!returnRequest) throw new Error("Return request not found");
  if (returnRequest.status !== "requested") throw new Error(`Cannot reject a return request with status "${returnRequest.status}"`);

  return prisma.returnRequest.update({ where: { id }, data: { status: "rejected", adminNote: adminNote || null } });
}
