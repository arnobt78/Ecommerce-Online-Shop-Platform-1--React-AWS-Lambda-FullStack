/**
 * AWS Lambda Function: Admin - Update User
 *
 * This Lambda function handles PUT requests to update user information (admin only).
 *
 * Endpoint: PUT /admin/users/{id}
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Request Body:
 * {
 *   "name": "Updated Name",
 *   "email": "updated@example.com",
 *   "role": "admin" // or "user"
 * }
 *
 * Response:
 * {
 *   "id": "...",
 *   "name": "Updated Name",
 *   "email": "updated@example.com",
 *   "role": "admin",
 *   "updatedAt": "2025-12-02T...",
 *   ...
 * }
 */

const { updateUser, getUserById } = require("../../shared/users");
const { requireAuth } = require("../../shared/auth");
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
  // Log the incoming request for debugging
  console.log("Admin User Update Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
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

    // Check if user is admin - get role from JWT token (no DynamoDB call needed)
    // Role is included in JWT token to optimize performance and reduce RCU usage
    if (decoded.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return errorResponse("User ID is required in path", 400);
    }

    // Parse request body
    let updates;
    try {
      updates = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate that at least one field is provided
    if (Object.keys(updates).length === 0) {
      return errorResponse("At least one field must be provided for update", 400);
    }

    // Don't allow password updates through this endpoint (use separate password reset endpoint)
    if (updates.password !== undefined) {
      return errorResponse("Password cannot be updated through this endpoint", 400);
    }

    // Get existing user to check previous values
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return errorResponse("User not found", 404);
    }

    // Update user (uses UpdateCommand - efficient, only updates specified fields)
    const updatedUser = await updateUser(userId, updates);

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: decoded.id,
      userEmail: decoded.email,
      userName: decoded.name,
      action: "update",
      entityType: "user",
      entityId: userId,
      details: {
        userEmail: updatedUser.email,
        userName: updatedUser.name,
        updatedFields: Object.keys(updates),
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    return successResponse(updatedUser, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Admin User Update Error:", {
      message: error.message,
      name: error.name,
      code: error.code,
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

    // Handle validation errors
    if (error.message.includes("Email already in use") || error.message.includes("Invalid role")) {
      return errorResponse(error.message, 400);
    }

    // Return error response
    return errorResponse(
      {
        message: error.message || "Internal server error",
        error: error.name || "UnknownError",
        code: error.code || "NO_CODE",
      },
      500
    );
  }
};

