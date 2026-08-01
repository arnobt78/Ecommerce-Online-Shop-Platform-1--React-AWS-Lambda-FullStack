/**
 * AWS Lambda Function: Get Notification Count
 *
 * This Lambda function handles GET requests to get unread notification count.
 *
 * Endpoint: GET /notifications/count
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * Response:
 * {
 *   "count": 5,
 *   "notificationsReadAt": "2025-12-06T12:00:00.000Z"
 * }
 */

const { getUserById } = require("../../shared/users");
const { getAllOrders } = require("../../shared/orders");
const { getAllTickets, getTicketsByUserId } = require("../../shared/tickets");
const { requireAuth } = require("../../shared/auth");
const {
  successResponse,
  errorResponse,
  handleOptions,
} = require("../../shared/response");

/**
 * Calculate unread notification count for a user
 *
 * @param {Object} user - User object with notificationsReadAt
 * @param {Array} orders - All orders array
 * @param {Array} tickets - All tickets array (for admin) or user tickets (for customer)
 * @returns {number} Unread notification count
 */
function calculateNotificationCount(user, orders, tickets = []) {
  if (!user || !orders) return 0;

  const notificationsReadAt = user.notificationsReadAt
    ? new Date(user.notificationsReadAt)
    : null;

  // If user never read notifications, count all relevant orders and tickets
  if (!notificationsReadAt) {
    let orderCount = 0;
    let ticketCount = 0;

    if (user.role === "admin") {
      // Admin: count new orders (payment success) + own order status changes
      const newOrders = orders.filter(
        (order) =>
          order.paymentStatus === "paid" &&
          (!order.userId || order.userId !== user.id) // Not admin's own orders
      );
      // Count admin's own orders with status changes
      const ownOrders = orders.filter(
        (order) =>
          order.userId === user.id &&
          order.status !== "pending" &&
          order.status !== "processing"
      );
      orderCount = newOrders.length + ownOrders.length;

      // Admin: count new tickets (created by customers, not admin)
      const newTickets = tickets.filter(
        (ticket) => ticket.userId !== user.id // Not admin's own tickets
      );
      ticketCount = newTickets.length;
    } else {
      // Customer: count own orders with status changes
      const ownOrders = orders.filter(
        (order) =>
          order.userId === user.id &&
          order.status !== "pending" &&
          order.status !== "processing"
      );
      orderCount = ownOrders.length;

      // Customer: count tickets with admin replies or status changes
      // A ticket has a notification if:
      // 1. Admin has replied (messages with senderRole === "admin")
      // 2. Status changed to resolved/closed
      ticketCount = tickets.filter((ticket) => {
        // Check if admin has replied
        const hasAdminReply = ticket.messages?.some(
          (msg) => msg.senderRole === "admin"
        );
        // Check if status changed (not open)
        const statusChanged = ticket.status !== "open";
        return hasAdminReply || statusChanged;
      }).length;
    }

    return orderCount + ticketCount;
  }

  // Count orders and tickets updated after notificationsReadAt
  let orderCount = 0;
  let ticketCount = 0;

  if (user.role === "admin") {
    // Admin: new orders (payment success) + own order status changes
    const newOrders = orders.filter(
      (order) =>
        order.paymentStatus === "paid" &&
        (!order.userId || order.userId !== user.id) &&
        new Date(order.createdAt || order.updatedAt) > notificationsReadAt
    );
    const ownOrders = orders.filter(
      (order) =>
        order.userId === user.id &&
        order.status !== "pending" &&
        order.status !== "processing" &&
        new Date(order.updatedAt || order.createdAt) > notificationsReadAt
    );
    orderCount = newOrders.length + ownOrders.length;

    // Admin: count new tickets created after notificationsReadAt
    const newTickets = tickets.filter(
      (ticket) =>
        ticket.userId !== user.id && // Not admin's own tickets
        new Date(ticket.createdAt || ticket.updatedAt) > notificationsReadAt
    );
    ticketCount = newTickets.length;
  } else {
    // Customer: own order status changes
    const ownOrders = orders.filter(
      (order) =>
        order.userId === user.id &&
        order.status !== "pending" &&
        order.status !== "processing" &&
        new Date(order.updatedAt || order.createdAt) > notificationsReadAt
    );
    orderCount = ownOrders.length;

    // Customer: count tickets with admin replies or status changes after notificationsReadAt
    ticketCount = tickets.filter((ticket) => {
      // Check if ticket was updated after notificationsReadAt
      const ticketUpdated = new Date(ticket.updatedAt || ticket.createdAt) > notificationsReadAt;
      if (!ticketUpdated) return false;

      // Check if admin has replied (messages with senderRole === "admin" created after notificationsReadAt)
      const hasNewAdminReply = ticket.messages?.some(
        (msg) =>
          msg.senderRole === "admin" &&
          new Date(msg.createdAt) > notificationsReadAt
      );
      // Check if status changed (not open) after notificationsReadAt
      const statusChanged =
        ticket.status !== "open" &&
        new Date(ticket.updatedAt) > notificationsReadAt;

      return hasNewAdminReply || statusChanged;
    }).length;
  }

  return orderCount + ticketCount;
}

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object from HTTP API
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  console.log("Get Notification Count Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow GET method
  if (httpMethod !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  try {
    // Require authentication
    const decoded = requireAuth(event);

    // Get full user data (including notificationsReadAt)
    const user = await getUserById(decoded.id);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    // Get all orders for notification calculation
    // Note: This uses Scan which is necessary for notification calculation across all orders
    // For better performance with large datasets, consider caching orders or using a more efficient approach
    // However, with On-Demand mode and polling every 30s, this is acceptable for current scale
    const orders = await getAllOrders();

    // Get tickets for notification calculation
    let tickets = [];
    if (user.role === "admin") {
      // Admin: get all tickets
      tickets = await getAllTickets();
    } else {
      // Customer: get only their own tickets
      tickets = await getTicketsByUserId(user.id);
    }

    // Calculate unread notification count (includes orders and tickets)
    const count = calculateNotificationCount(user, orders, tickets);
    
    // Calculate separate counts for orders and tickets to help frontend determine redirect
    const notificationsReadAt = user.notificationsReadAt
      ? new Date(user.notificationsReadAt)
      : null;
    
    let orderCount = 0;
    let ticketCount = 0;
    
    if (user.role === "admin") {
      // Admin: count new orders (payment success) + own order status changes
      const newOrders = notificationsReadAt
        ? orders.filter(
            (order) =>
              order.paymentStatus === "paid" &&
              (!order.userId || order.userId !== user.id) &&
              new Date(order.createdAt || order.updatedAt) > notificationsReadAt
          )
        : orders.filter(
            (order) =>
              order.paymentStatus === "paid" &&
              (!order.userId || order.userId !== user.id)
          );
      const ownOrders = notificationsReadAt
        ? orders.filter(
            (order) =>
              order.userId === user.id &&
              order.status !== "pending" &&
              order.status !== "processing" &&
              new Date(order.updatedAt || order.createdAt) > notificationsReadAt
          )
        : orders.filter(
            (order) =>
              order.userId === user.id &&
              order.status !== "pending" &&
              order.status !== "processing"
          );
      orderCount = newOrders.length + ownOrders.length;

      // Admin: count new tickets created after notificationsReadAt
      const newTickets = notificationsReadAt
        ? tickets.filter(
            (ticket) =>
              ticket.userId !== user.id &&
              new Date(ticket.createdAt || ticket.updatedAt) > notificationsReadAt
          )
        : tickets.filter((ticket) => ticket.userId !== user.id);
      ticketCount = newTickets.length;
    } else {
      // Customer: own order status changes
      const ownOrders = notificationsReadAt
        ? orders.filter(
            (order) =>
              order.userId === user.id &&
              order.status !== "pending" &&
              order.status !== "processing" &&
              new Date(order.updatedAt || order.createdAt) > notificationsReadAt
          )
        : orders.filter(
            (order) =>
              order.userId === user.id &&
              order.status !== "pending" &&
              order.status !== "processing"
          );
      orderCount = ownOrders.length;

      // Customer: count tickets with admin replies or status changes after notificationsReadAt
      ticketCount = notificationsReadAt
        ? tickets.filter((ticket) => {
            const ticketUpdated = new Date(ticket.updatedAt || ticket.createdAt) > notificationsReadAt;
            if (!ticketUpdated) return false;
            const hasNewAdminReply = ticket.messages?.some(
              (msg) =>
                msg.senderRole === "admin" &&
                new Date(msg.createdAt) > notificationsReadAt
            );
            const statusChanged =
              ticket.status !== "open" &&
              new Date(ticket.updatedAt) > notificationsReadAt;
            return hasNewAdminReply || statusChanged;
          }).length
        : tickets.filter((ticket) => {
            const hasAdminReply = ticket.messages?.some(
              (msg) => msg.senderRole === "admin"
            );
            const statusChanged = ticket.status !== "open";
            return hasAdminReply || statusChanged;
          }).length;
    }

    // Return success response with breakdown
    return successResponse(
      {
        count,
        orderCount,
        ticketCount,
        notificationsReadAt: user.notificationsReadAt || null,
      },
      200
    );
  } catch (error) {
    console.error("Get Notification Count Error:", {
      error: error.message,
      stack: error.stack,
    });

    // Handle authentication errors
    if (
      error.message === "No token provided" ||
      error.message === "Invalid token"
    ) {
      return errorResponse("Unauthorized", 401);
    }

    // Return error response
    return errorResponse(
      {
        message: error.message || "Internal server error",
        error: error.name || "UnknownError",
      },
      500
    );
  }
};

