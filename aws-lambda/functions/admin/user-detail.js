/**
 * AWS Lambda Function: Admin - Get User by ID
 *
 * This Lambda function handles GET requests to fetch a single user by ID (admin only).
 *
 * Endpoint: GET /admin/users/{id}
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Response:
 * {
 *   "id": "...",
 *   "email": "...",
 *   "name": "...",
 *   "role": "user",
 *   "createdAt": "2025-12-02T...",
 *   ...
 * }
 */

const { getUserById } = require("../../shared/users");
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
  // Log the incoming request for debugging
  console.log("Admin User Detail Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    pathParameters: event.pathParameters,
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

    // Get user by ID (uses GetCommand - most efficient, single item read)
    const user = await getUserById(userId);

    if (!user) {
      return errorResponse("User not found", 404);
    }

    // Return success response (password already excluded by getUserById)
    return successResponse(user, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Admin User Detail Error:", {
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

