// Parent: REQ-1202, REQ-1205, REQ-1301
// Ported from aws-lambda/functions/notifications/count.js (logic lived inline
// there, no shared module — moved into a service here for reuse/testability).

import type { Order, Ticket, User } from "@prisma/client";
import { getAllOrders } from "./orders.service";
import { getAllTickets, getTicketsByUserId } from "./tickets.service";
import type { TicketMessage } from "./tickets.service";

interface NotificationCounts {
  orderCount: number;
  ticketCount: number;
}

function countOrdersAndTickets(
  user: Pick<User, "id" | "role">,
  orders: Order[],
  tickets: Ticket[],
  notificationsReadAt: Date | null
): NotificationCounts {
  let orderCount = 0;
  let ticketCount = 0;

  if (user.role === "admin") {
    const newOrders = orders.filter(
      (order) =>
        order.paymentStatus === "paid" &&
        (!order.userId || order.userId !== user.id) &&
        (!notificationsReadAt || new Date(order.createdAt || order.updatedAt) > notificationsReadAt)
    );
    const ownOrders = orders.filter(
      (order) =>
        order.userId === user.id &&
        order.status !== "pending" &&
        order.status !== "processing" &&
        (!notificationsReadAt || new Date(order.updatedAt || order.createdAt) > notificationsReadAt)
    );
    orderCount = newOrders.length + ownOrders.length;

    const newTickets = tickets.filter(
      (ticket) =>
        ticket.userId !== user.id &&
        (!notificationsReadAt || new Date(ticket.createdAt || ticket.updatedAt) > notificationsReadAt)
    );
    ticketCount = newTickets.length;
  } else {
    const ownOrders = orders.filter(
      (order) =>
        order.userId === user.id &&
        order.status !== "pending" &&
        order.status !== "processing" &&
        (!notificationsReadAt || new Date(order.updatedAt || order.createdAt) > notificationsReadAt)
    );
    orderCount = ownOrders.length;

    ticketCount = tickets.filter((ticket) => {
      const messages = (ticket.messages as unknown as TicketMessage[]) || [];
      if (notificationsReadAt) {
        const ticketUpdated = new Date(ticket.updatedAt || ticket.createdAt) > notificationsReadAt;
        if (!ticketUpdated) return false;
        const hasNewAdminReply = messages.some(
          (msg) => msg.senderRole === "admin" && new Date(msg.createdAt) > notificationsReadAt
        );
        const statusChanged = ticket.status !== "open" && new Date(ticket.updatedAt) > notificationsReadAt;
        return hasNewAdminReply || statusChanged;
      }
      const hasAdminReply = messages.some((msg) => msg.senderRole === "admin");
      const statusChanged = ticket.status !== "open";
      return hasAdminReply || statusChanged;
    }).length;
  }

  return { orderCount, ticketCount };
}

export interface NotificationSummary extends NotificationCounts {
  count: number;
  notificationsReadAt: Date | null;
}

export async function getNotificationSummary(
  user: Pick<User, "id" | "role" | "notificationsReadAt">
): Promise<NotificationSummary> {
  const orders = await getAllOrders();
  const tickets = user.role === "admin" ? await getAllTickets() : await getTicketsByUserId(user.id);

  const notificationsReadAt = user.notificationsReadAt ? new Date(user.notificationsReadAt) : null;
  const { orderCount, ticketCount } = countOrdersAndTickets(user, orders, tickets, notificationsReadAt);

  return {
    count: orderCount + ticketCount,
    orderCount,
    ticketCount,
    notificationsReadAt: user.notificationsReadAt || null,
  };
}
