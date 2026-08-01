// Parent: REQ-1202, REQ-1205, REQ-1301, REQ-1304
// Ported from aws-lambda/shared/tickets.js — same function contracts.
// `messages` stays a JSON array on the ticket row, exactly like the DynamoDB item.

import { randomUUID } from "crypto";
import { z } from "zod";
import type { Prisma, Ticket } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface TicketMessage {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TICKET_CATEGORIES = ["billing", "technical", "refund", "account", "other"] as const;

// Parent: REQ-1304 — validated at the POST /tickets route boundary.
export const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  orderId: z.string().optional(),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

interface CreateTicketInput {
  userId: string;
  customerEmail: string;
  customerName: string;
  subject: string;
  message: string;
  priority?: string;
  category?: string;
  orderId?: string;
}

export async function createTicket({
  userId,
  customerEmail,
  customerName,
  subject,
  message,
  priority,
  category,
  orderId,
}: CreateTicketInput): Promise<Ticket> {
  if (!userId || !customerEmail || !subject || !message) {
    throw new Error("Missing required fields: userId, customerEmail, subject, message");
  }

  const now = new Date().toISOString();

  return prisma.ticket.create({
    data: {
      userId,
      customerEmail,
      customerName: customerName || "Customer",
      subject: subject.trim(),
      status: "open",
      priority: priority || "medium",
      category: category || "other",
      orderId: orderId || null,
      messages: [
        {
          id: randomUUID(),
          senderId: userId,
          senderEmail: customerEmail,
          senderName: customerName || "Customer",
          senderRole: "customer",
          message: message.trim(),
          createdAt: now,
        } satisfies TicketMessage,
      ],
    },
  });
}

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  return prisma.ticket.findUnique({ where: { id: ticketId } });
}

export async function getTicketsByUserId(userId: string): Promise<Ticket[]> {
  return prisma.ticket.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

export async function getAllTickets(): Promise<Ticket[]> {
  return prisma.ticket.findMany({ orderBy: { updatedAt: "desc" } });
}

interface AddTicketReplyInput {
  senderId: string;
  senderEmail: string;
  senderName?: string;
  senderRole: string;
  message: string;
}

export async function addTicketReply(
  ticketId: string,
  { senderId, senderEmail, senderName, senderRole, message }: AddTicketReplyInput
): Promise<Ticket> {
  if (!senderId || !senderEmail || !senderRole || !message) {
    throw new Error("Missing required fields: senderId, senderEmail, senderRole, message");
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const reply: TicketMessage = {
    id: randomUUID(),
    senderId,
    senderEmail,
    senderName: senderName || (senderRole === "admin" ? "Admin" : "Customer"),
    senderRole,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  const existingMessages = (ticket.messages as unknown as TicketMessage[]) || [];
  const updatedMessages = [...existingMessages, reply];
  const updatedStatus = senderRole === "admin" && ticket.status === "open" ? "in_progress" : ticket.status;

  return prisma.ticket.update({
    where: { id: ticketId },
    data: { messages: updatedMessages as unknown as Prisma.InputJsonValue, status: updatedStatus },
  });
}

const VALID_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export async function updateTicketStatus(ticketId: string, status: string): Promise<Ticket> {
  if (!(VALID_TICKET_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_TICKET_STATUSES.join(", ")}`);
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return prisma.ticket.update({ where: { id: ticketId }, data: { status } });
}

export async function updateTicketPriority(ticketId: string, priority: string): Promise<Ticket> {
  if (!(TICKET_PRIORITIES as readonly string[]).includes(priority)) {
    throw new Error(`Invalid priority. Must be one of: ${TICKET_PRIORITIES.join(", ")}`);
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return prisma.ticket.update({ where: { id: ticketId }, data: { priority } });
}
