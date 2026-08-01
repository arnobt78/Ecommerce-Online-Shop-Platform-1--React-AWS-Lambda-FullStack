// Parent: REQ-1200, REQ-1301, REQ-1304 — parity with aws-lambda/functions/tickets/*.js
// Mounted at /tickets in app.ts (`app.use("/tickets", ticketsRoutes)`) — every
// route below is relative to that prefix. This scopes `router.use(requireAuth)`
// to only /tickets* requests instead of intercepting the whole app.

import express, { type Request, type Response } from "express";
import { successResponse, errorResponse } from "../lib/response";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../services/activityLog.service";
import * as ticketsService from "../services/tickets.service";
import { createTicketSchema, replyTicketSchema } from "../services/tickets.service";
import { getUserById } from "../services/users.service";
import { getOrderById } from "../services/orders.service";

const router = express.Router();

router.use(requireAuth);

// POST /tickets
router.post("/", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);

    const parsed = createTicketSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, "Missing required fields: subject, message", 400);
    }
    const { subject, message, priority, category, orderId } = parsed.data;

    // Ownership check, same pattern as reviews.routes.ts: a ticket may only
    // reference an order that actually belongs to the reporting user.
    if (orderId) {
      const order = await getOrderById(orderId);
      if (!order || order.userId !== user.id) {
        return errorResponse(res, "Order not found or does not belong to you", 404);
      }
    }

    const ticket = await ticketsService.createTicket({
      userId: user.id,
      customerEmail: user.email,
      customerName: user.name || "Customer",
      subject: subject.trim(),
      message: message.trim(),
      priority,
      category,
      orderId,
    });

    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "create",
      entityType: "ticket",
      entityId: ticket.id,
      details: { ticketSubject: ticket.subject, ticketId: ticket.id, customerEmail: user.email },
    });

    return successResponse(res, ticket, 201);
  } catch (error) {
    console.error("Ticket create error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /tickets — admin sees all, customer sees only their own.
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);

    const tickets =
      user.role === "admin" ? await ticketsService.getAllTickets() : await ticketsService.getTicketsByUserId(user.id);

    return successResponse(res, { tickets });
  } catch (error) {
    console.error("Tickets list error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// GET /tickets/:ticketId
router.get("/:ticketId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);

    const ticket = await ticketsService.getTicketById(req.params.ticketId!);
    if (!ticket) return errorResponse(res, "Ticket not found", 404);

    if (user.role !== "admin" && ticket.userId !== user.id) {
      return errorResponse(res, "Unauthorized: You can only access your own tickets", 403);
    }

    return successResponse(res, ticket);
  } catch (error) {
    console.error("Ticket detail error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// POST /tickets/:ticketId/reply
router.post("/:ticketId/reply", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);

    const ticket = await ticketsService.getTicketById(req.params.ticketId!);
    if (!ticket) return errorResponse(res, "Ticket not found", 404);

    if (user.role !== "admin" && ticket.userId !== user.id) {
      return errorResponse(res, "Unauthorized: You can only reply to your own tickets", 403);
    }

    const parsed = replyTicketSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return errorResponse(res, "Message is required", 400);
    }
    const { message } = parsed.data;

    const updatedTicket = await ticketsService.addTicketReply(req.params.ticketId!, {
      senderId: user.id,
      senderEmail: user.email,
      senderName: user.name || undefined,
      senderRole: user.role,
      message: message.trim(),
    });

    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "update",
      entityType: "ticket",
      entityId: req.params.ticketId!,
      details: {
        ticketSubject: ticket.subject,
        ticketId: req.params.ticketId,
        action: "reply_added",
        senderRole: user.role,
        customerEmail: ticket.customerEmail,
      },
    });

    return successResponse(res, updatedTicket);
  } catch (error) {
    console.error("Ticket reply error:", error);
    return errorResponse(res, { message: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

// PUT /tickets/:ticketId/status — admin only
router.put("/:ticketId/status", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);
    if (user.role !== "admin") return errorResponse(res, "Unauthorized: Admin access required", 403);

    const ticket = await ticketsService.getTicketById(req.params.ticketId!);
    if (!ticket) return errorResponse(res, "Ticket not found", 404);

    const { status } = req.body || {};
    if (!status) return errorResponse(res, "Status is required", 400);

    const updatedTicket = await ticketsService.updateTicketStatus(req.params.ticketId!, status);

    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "status_change",
      entityType: "ticket",
      entityId: req.params.ticketId!,
      details: {
        ticketSubject: ticket.subject,
        ticketId: req.params.ticketId,
        previousStatus: ticket.status,
        newStatus: status,
        customerEmail: ticket.customerEmail,
      },
    });

    return successResponse(res, updatedTicket);
  } catch (error) {
    console.error("Ticket status update error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.startsWith("Invalid status")) return errorResponse(res, message, 400);
    return errorResponse(res, { message }, 500);
  }
});

// PUT /tickets/:ticketId/priority — admin only, REQ-1619 triage escalation
router.put("/:ticketId/priority", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return errorResponse(res, "User not found", 404);
    if (user.role !== "admin") return errorResponse(res, "Unauthorized: Admin access required", 403);

    const ticket = await ticketsService.getTicketById(req.params.ticketId!);
    if (!ticket) return errorResponse(res, "Ticket not found", 404);

    const { priority } = req.body || {};
    if (!priority) return errorResponse(res, "Priority is required", 400);

    const updatedTicket = await ticketsService.updateTicketPriority(req.params.ticketId!, priority);

    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "update",
      entityType: "ticket",
      entityId: req.params.ticketId!,
      details: {
        ticketSubject: ticket.subject,
        ticketId: req.params.ticketId,
        previousPriority: ticket.priority,
        newPriority: priority,
        customerEmail: ticket.customerEmail,
      },
    });

    return successResponse(res, updatedTicket);
  } catch (error) {
    console.error("Ticket priority update error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.startsWith("Invalid priority")) return errorResponse(res, message, 400);
    return errorResponse(res, { message }, 500);
  }
});

export default router;
