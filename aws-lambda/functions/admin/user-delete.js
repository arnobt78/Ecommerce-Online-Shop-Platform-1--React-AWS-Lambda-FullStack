/**
 * AWS Lambda Function: Admin - Delete User
 *
 * This Lambda function handles DELETE requests to delete a user (admin only).
 *
 * Endpoint: DELETE /admin/users/{id}
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Response:
 * {
 *   "message": "User deleted successfully",
 *   "id": "..."
 * }
 */

const { deleteUser, getUserById } = require("../../shared/users");
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
  console.log("Admin User Delete Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
  });

  // Handle CORS preflight request (OPTIONS)
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow DELETE method
  if (httpMethod !== "DELETE") {
    return errorResponse("Method not allowed. Use DELETE.", 405);
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

    // Prevent admin from deleting themselves
    if (decoded.id === userId) {
      return errorResponse("Cannot delete your own account", 400);
    }

    // Get existing user before deletion (for logging)
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return errorResponse("User not found", 404);
    }

    // Delete user (uses DeleteCommand - efficient, single item delete)
    const result = await deleteUser(userId);

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: decoded.id,
      userEmail: decoded.email,
      userName: decoded.name,
      action: "delete",
      entityType: "user",
      entityId: userId,
      details: {
        deletedUserEmail: existingUser.email,
        deletedUserName: existingUser.name,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    // Return success response
    return successResponse(result, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Admin User Delete Error:", {
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

