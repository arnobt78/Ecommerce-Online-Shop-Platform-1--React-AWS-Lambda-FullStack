/**
 * AWS Lambda Function: Get Single Support Ticket
 *
 * This Lambda function handles GET requests to retrieve a single ticket by ID.
 *
 * Endpoint: GET /tickets/:ticketId
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * Behavior:
 * - Customers: Can only access their own tickets
 * - Admins: Can access any ticket
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

const { getTicketById } = require("../../shared/tickets");
const { requireAuth } = require("../../shared/auth");
const { getUserById } = require("../../shared/users");
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
  console.log("Get Ticket Lambda invoked:", {
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

    // Get ticket
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return errorResponse("Ticket not found", 404);
    }

    // Check authorization: customers can only access their own tickets
    if (user.role !== "admin" && ticket.userId !== user.id) {
      return errorResponse("Unauthorized: You can only access your own tickets", 403);
    }

    // Return success response
    return successResponse(ticket, 200);
  } catch (error) {
    console.error("Get Ticket Error:", {
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

