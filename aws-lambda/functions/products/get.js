/**
 * AWS Lambda Function: Product Detail
 *
 * This Lambda function handles GET requests to retrieve a single product by ID.
 *
 * Endpoint: GET /products/{id}
 *
 * Path Parameters:
 * - id (required): Product ID (UUID)
 *
 * Example requests:
 * - GET /products/b49ea38d-de9b-4d97-bb5d-787a11709c08
 *
 * How it works:
 * 1. Extracts product ID from path parameters
 * 2. Fetches product from DynamoDB
 * 3. Returns product or 404 if not found
 */

const { getProductById } = require("../../shared/products");
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
  console.log("Product Detail Lambda invoked:", {
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
    // Extract product ID from path parameters
    // HTTP API v2: pathParameters contains route parameters
    // Example: /products/{id} -> pathParameters: { id: "b49ea38d-..." }
    const productId = event.pathParameters?.id;

    if (!productId) {
      return errorResponse("Product ID is required", 400);
    }

    // Get product from DynamoDB
    const product = await getProductById(productId);

    if (!product) {
      return errorResponse("Product not found", 404);
    }

    // Return success response
    return successResponse(product, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring
    console.error("Product Detail Error:", {
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

