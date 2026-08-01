/**
 * AWS Lambda Function: Products List
 *
 * This Lambda function handles GET requests to retrieve all products.
 *
 * Endpoint: GET /products
 *
 * Query Parameters:
 * - name_like (optional): Search term to filter products by name or overview
 *
 * Example requests:
 * - GET /products (returns all products)
 * - GET /products?name_like=book (returns products matching "book")
 *
 * How Lambda functions work:
 * 1. AWS API Gateway receives HTTP request
 * 2. API Gateway invokes this Lambda function
 * 3. Lambda function receives event object with request details
 * 4. Function processes request and returns response
 * 5. API Gateway sends response back to client
 */

const { getAllProducts } = require("../../shared/products");
const {
  successResponse,
  errorResponse,
  handleOptions,
} = require("../../shared/response");

/**
 * Lambda Handler Function
 *
 * This is the entry point for the Lambda function.
 * AWS Lambda calls this function when the API Gateway route is triggered.
 *
 * @param {object} event - Lambda event object containing request information
 * @param {object} context - Lambda context object (runtime information)
 * @returns {Promise<object>} Lambda response object
 *
 * Event structure (from API Gateway):
 * {
 *   httpMethod: 'GET',
 *   path: '/products',
 *   queryStringParameters: { name_like: 'book' },
 *   headers: { ... },
 *   body: null (for GET requests)
 * }
 */
exports.handler = async (event, context) => {
  // Log the incoming request for debugging
  console.log("Products List Lambda invoked:", JSON.stringify(event, null, 2));

  // HTTP API v2 uses different event format than REST API
  // HTTP API v2 format:
  //   - requestContext.http.method (not httpMethod)
  //   - requestContext.http.path (not path)
  //   - rawQueryString (query string as string, e.g., "name_like=book")
  //   - queryStringParameters (parsed object, e.g., { name_like: 'book' })

  // Handle both HTTP API v2 and REST API formats for compatibility
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;

  console.log("Request details:", {
    httpMethod,
    path,
    rawQueryString: event.rawQueryString,
    queryStringParameters: event.queryStringParameters,
    fullEvent: JSON.stringify(event, null, 2),
  });

  // Handle CORS preflight request (OPTIONS)
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow GET method
  if (httpMethod !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  try {
    // Extract search term from query parameters
    // HTTP API v2: queryStringParameters is an object (e.g., { name_like: 'book' })
    // If not available, parse from rawQueryString
    let searchTerm = "";
    if (event.queryStringParameters?.name_like) {
      searchTerm = event.queryStringParameters.name_like;
    } else if (event.rawQueryString) {
      // Parse from raw query string if queryStringParameters not available
      const params = new URLSearchParams(event.rawQueryString);
      searchTerm = params.get("name_like") || "";
    }

    // Get products from DynamoDB
    // This calls our helper function which uses AWS SDK to query DynamoDB
    let products;
    try {
      products = await getAllProducts(searchTerm);
    } catch (getAllProductsError) {
      console.error("getAllProducts failed in Lambda handler:", {
        message: getAllProductsError.message,
        name: getAllProductsError.name,
        code: getAllProductsError.code,
        stack: getAllProductsError.stack,
      });
      throw getAllProductsError; // Re-throw to be caught by outer catch
    }

    // Ensure products is an array (safety check)
    const productsArray = Array.isArray(products) ? products : [];

    // Log successful response for debugging
    console.log("Products List Success:", {
      totalProducts: productsArray.length,
      searchTerm: searchTerm || "none",
    });

    // Return success response
    // Lambda response format: { statusCode, headers, body }
    // body must be a JSON string
    return successResponse(productsArray, 200);
  } catch (error) {
    // Log error for CloudWatch monitoring with full details
    console.error("Products List Error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      errorString: String(error),
      errorKeys: Object.keys(error),
    });

    // Return error response with details for debugging
    // TODO: In production, hide sensitive error details
    return errorResponse(
      {
        message: error.message || "Internal server error",
        error: error.name || "UnknownError",
        code: error.code || "NO_CODE",
        // Only include stack in development
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      },
      500
    );
  }
};
