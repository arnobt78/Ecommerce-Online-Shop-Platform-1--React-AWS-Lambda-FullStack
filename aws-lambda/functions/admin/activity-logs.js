/**
 * AWS Lambda Function: Admin - Get Activity Logs
 *
 * This Lambda function handles GET requests to retrieve activity logs (admin only).
 *
 * Endpoint: GET /admin/activity-logs
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Admin role required
 *
 * Query Parameters:
 * - entityType: Filter by entity type (order, product, user) - optional
 * - action: Filter by action (create, update, delete, status_change) - optional
 * - limit: Limit results (default: 100) - optional
 *
 * Response:
 * {
 *   "logs": [
 *     {
 *       "id": "...",
 *       "userId": "...",
 *       "userEmail": "...",
 *       "userName": "...",
 *       "action": "update",
 *       "entityType": "order",
 *       "entityId": "...",
 *       "details": {...},
 *       "createdAt": "2025-12-06T..."
 *     }
 *   ]
 * }
 */

const { getAllActivityLogs } = require("../../shared/activityLog");
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
  console.log("Admin Activity Logs Lambda invoked:", {
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path,
    queryStringParameters: event.queryStringParameters,
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
    // Require authentication and admin role
    const user = await requireAuth(event);
    if (user.role !== "admin") {
      return errorResponse("Admin access required", 403);
    }

    // Extract query parameters
    const queryParams = event.queryStringParameters || {};
    const entityType = queryParams.entityType;
    const action = queryParams.action;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;

    // Get activity logs with filters
    const logs = await getAllActivityLogs({
      entityType,
      action,
      limit,
    });

    // Return success response
    return successResponse(
      {
        logs,
        count: logs.length,
      },
      200
    );
  } catch (error) {
    console.error("Admin Activity Logs Error:", {
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

