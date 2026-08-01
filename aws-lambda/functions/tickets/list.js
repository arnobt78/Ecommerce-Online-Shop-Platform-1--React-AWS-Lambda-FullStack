/**
 * AWS Lambda Function: Get Support Tickets
 *
 * This Lambda function handles GET requests to retrieve support tickets.
 *
 * Endpoint: GET /tickets
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * Behavior:
 * - Customers: Get only their own tickets
 * - Admins: Get all tickets
 *
 * Response:
 * {
 *   "tickets": [
 *     {
 *       "id": "ticket-uuid",
 *       "userId": "user-uuid",
 *       "subject": "Issue with my order",
 *       "status": "open",
 *       "messages": [...],
 *       "createdAt": "2025-12-07T12:00:00.000Z"
 *     }
 *   ]
 * }
 */

const {
  getTicketsByUserId,
  getAllTickets,
} = require("../../shared/tickets");
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
  console.log("Get Tickets Lambda invoked:", {
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

    // Get tickets based on user role
    let tickets = [];
    if (user.role === "admin") {
      // Admin: get all tickets
      tickets = await getAllTickets();
    } else {
      // Customer: get only their own tickets
      tickets = await getTicketsByUserId(user.id);
    }

    // Return success response
    return successResponse({ tickets }, 200);
  } catch (error) {
    console.error("Get Tickets Error:", {
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

