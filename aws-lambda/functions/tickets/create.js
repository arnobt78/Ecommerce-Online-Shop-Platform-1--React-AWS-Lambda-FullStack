/**
 * AWS Lambda Function: Create Support Ticket
 *
 * This Lambda function handles POST requests to create a new support ticket.
 *
 * Endpoint: POST /tickets
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * Request Body:
 * {
 *   "subject": "Issue with my order",
 *   "message": "I haven't received my order yet..."
 * }
 *
 * Response:
 * {
 *   "id": "ticket-uuid",
 *   "userId": "user-uuid",
 *   "subject": "Issue with my order",
 *   "status": "open",
 *   "messages": [...],
 *   "createdAt": "2025-12-07T12:00:00.000Z"
 * }
 */

const { createTicket } = require("../../shared/tickets");
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
  console.log("Create Ticket Lambda invoked:", {
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

    // Parse request body
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate required fields
    const { subject, message } = body;
    if (!subject || !message) {
      return errorResponse("Missing required fields: subject, message", 400);
    }

    // Create ticket
    const ticket = await createTicket({
      userId: user.id,
      customerEmail: user.email,
      customerName: user.name,
      subject: subject.trim(),
      message: message.trim(),
    });

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "create",
      entityType: "ticket",
      entityId: ticket.id,
      details: {
        ticketSubject: ticket.subject,
        ticketId: ticket.id,
        customerEmail: user.email,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    return successResponse(ticket, 201);
  } catch (error) {
    console.error("Create Ticket Error:", {
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

