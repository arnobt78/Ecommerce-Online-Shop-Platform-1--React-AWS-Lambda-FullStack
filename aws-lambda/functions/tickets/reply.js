/**
 * AWS Lambda Function: Reply to Support Ticket
 *
 * This Lambda function handles POST requests to add a reply to a ticket.
 *
 * Endpoint: POST /tickets/:ticketId/reply
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * Request Body:
 * {
 *   "message": "Thank you for your inquiry. We'll look into this..."
 * }
 *
 * Response:
 * {
 *   "id": "ticket-uuid",
 *   "messages": [...],
 *   "status": "in_progress",
 *   "updatedAt": "2025-12-07T12:00:00.000Z"
 * }
 */

const { getTicketById, addTicketReply } = require("../../shared/tickets");
const { requireAuth } = require("../../shared/auth");
const { getUserById } = require("../../shared/users");
const { logActivity } = require("../../shared/activityLog");
const {
  successResponse,
  errorResponse,
  handleOptions,
} = require("../../shared/response");

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object from HTTP API
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  console.log("Reply to Ticket Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow POST method
  if (httpMethod !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // Require authentication
    const decoded = requireAuth(event);

    // Get user data
    const user = await getUserById(decoded.id);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    // Extract ticket ID from path
    const ticketId =
      event.pathParameters?.ticketId ||
      event.requestContext?.http?.path?.split("/").pop();

    if (!ticketId) {
      return errorResponse("Ticket ID is required", 400);
    }

    // Get ticket to check authorization
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return errorResponse("Ticket not found", 404);
    }

    // Check authorization: customers can only reply to their own tickets
    if (user.role !== "admin" && ticket.userId !== user.id) {
      return errorResponse("Unauthorized: You can only reply to your own tickets", 403);
    }

    // Parse request body
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate required fields
    const { message } = body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return errorResponse("Message is required", 400);
    }

    // Add reply
    const updatedTicket = await addTicketReply(ticketId, {
      senderId: user.id,
      senderEmail: user.email,
      senderName: user.name,
      senderRole: user.role,
      message: message.trim(),
    });

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "update",
      entityType: "ticket",
      entityId: ticketId,
      details: {
        ticketSubject: ticket.subject,
        ticketId: ticketId,
        action: "reply_added",
        senderRole: user.role,
        customerEmail: ticket.customerEmail,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    return successResponse(updatedTicket, 200);
  } catch (error) {
    console.error("Reply to Ticket Error:", {
      message: error.message,
      name: error.name,
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

