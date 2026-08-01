/**
 * AWS Lambda Function: Login
 *
 * This Lambda function handles POST requests to authenticate users.
 *
 * Endpoint: POST /login
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 *
 * Response:
 * {
 *   "accessToken": "jwt-token",
 *   "user": { "id": "...", "email": "...", "name": "..." }
 * }
 */

const { verifyUser } = require("../../shared/users");
const { generateToken } = require("../../shared/auth");
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
  console.log("Login Lambda invoked:", {
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
    // Parse request body
    // HTTP API v2: body is a JSON string, need to parse it
    const body = event.body ? JSON.parse(event.body) : {};

    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return errorResponse("Email and password are required", 400);
    }

    // Verify user credentials
    const user = await verifyUser(email, password);
    if (!user) {
      return errorResponse("Invalid credentials", 401);
    }

    // Generate JWT token
    const accessToken = generateToken(user);

    // Return success response with token and user
    return successResponse(
      {
        accessToken,
        user,
      },
      200
    );
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Login Error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    });

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

