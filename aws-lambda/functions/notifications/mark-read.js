/**
 * AWS Lambda Function: Mark Notifications as Read
 *
 * This Lambda function handles POST requests to mark user notifications as read.
 *
 * Endpoint: POST /notifications/mark-read
 *
 * Authentication: Required (Bearer token in Authorization header)
 *
 * Request Body: (empty - uses current timestamp)
 *
 * Response:
 * {
 *   "notificationsReadAt": "2025-12-06T12:00:00.000Z",
 *   "message": "Notifications marked as read"
 * }
 */

const { updateUser, getUserById } = require("../../shared/users");
const { requireAuth } = require("../../shared/auth");
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
  console.log("Mark Notifications Read Lambda invoked:", {
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
    const user = await requireAuth(event);

    // Update user's notificationsReadAt timestamp
    const notificationsReadAt = new Date().toISOString();
    const updatedUser = await updateUser(user.id, {
      notificationsReadAt,
    });

    // Return success response
    return successResponse(
      {
        notificationsReadAt: updatedUser.notificationsReadAt || notificationsReadAt,
        message: "Notifications marked as read",
      },
      200
    );
  } catch (error) {
    console.error("Mark Notifications Read Error:", {
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

    // Handle not found errors
    if (error.message === "User not found") {
      return errorResponse("User not found", 404);
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

