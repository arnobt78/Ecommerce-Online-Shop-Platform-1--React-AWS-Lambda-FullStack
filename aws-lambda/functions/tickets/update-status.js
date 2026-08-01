/**
 * AWS Lambda Function: Update Ticket Status
 *
 * This Lambda function handles PUT requests to update ticket status.
 * Only admins can update ticket status.
 *
 * Endpoint: PUT /tickets/:ticketId/status
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin only
 *
 * Request Body:
 * {
 *   "status": "resolved"
 * }
 *
 * Response:
 * {
 *   "id": "ticket-uuid",
 *   "status": "resolved",
 *   "updatedAt": "2025-12-07T12:00:00.000Z"
 * }
 */

const { getTicketById, updateTicketStatus } = require("../../shared/tickets");
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
  console.log("Update Ticket Status Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow PUT method
  if (httpMethod !== "PUT") {
    return errorResponse("Method not allowed. Use PUT.", 405);
  }

  try {
    // Require authentication
    const decoded = requireAuth(event);

    // Get user data
    const user = await getUserById(decoded.id);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    // Check admin authorization
    if (user.role !== "admin") {
      return errorResponse("Unauthorized: Admin access required", 403);
    }

    // Extract ticket ID from path
    const ticketId =
      event.pathParameters?.ticketId ||
      event.requestContext?.http?.path?.split("/").pop();

    if (!ticketId) {
      return errorResponse("Ticket ID is required", 400);
    }

    // Get ticket
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return errorResponse("Ticket not found", 404);
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
    const { status } = body;
    if (!status) {
      return errorResponse("Status is required", 400);
    }

    // Update ticket status
    const updatedTicket = await updateTicketStatus(ticketId, status);

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "status_change",
      entityType: "ticket",
      entityId: ticketId,
      details: {
        ticketSubject: ticket.subject,
        ticketId: ticketId,
        previousStatus: ticket.status,
        newStatus: status,
        customerEmail: ticket.customerEmail,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    return successResponse(updatedTicket, 200);
  } catch (error) {
    console.error("Update Ticket Status Error:", {
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

