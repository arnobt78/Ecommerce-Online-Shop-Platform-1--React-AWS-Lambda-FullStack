/**
 * AWS Lambda Function: Product Create
 *
 * This Lambda function handles POST requests to create new products.
 * Requires admin authentication.
 *
 * Endpoint: POST /admin/products
 *
 * Request Body:
 * {
 *   "name": "Product Name",
 *   "price": 29.99,
 *   "overview": "Short description",
 *   "long_description": "Full description",
 *   "image_local": "/assets/image.jpg",
 *   "poster": "https://image.url",
 *   "in_stock": true,
 *   "best_seller": false
 * }
 */

const { createProduct } = require("../../shared/products");
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
 * @param {object} event - Lambda event object
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  console.log("Product Create Lambda invoked:", JSON.stringify(event, null, 2));

  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  // Handle CORS preflight request
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow POST method
  if (httpMethod !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // Require admin authentication
    const user = await requireAuth(event);

    // Parse request body
    let productData;
    try {
      productData = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate required fields
    if (!productData.name || !productData.price) {
      return errorResponse("Name and price are required", 400);
    }

    // Get base URL from multiple sources (priority order):
    // 1. BASE_URL environment variable (set in Lambda/Vercel)
    // 2. baseUrl from request body (frontend can pass REACT_APP_BASE_URL)
    // 3. Origin header from request
    // 4. x-forwarded-host header
    // 5. null (no QR code generation)
    const baseUrl =
      process.env.BASE_URL ||
      productData.baseUrl ||
      event.headers?.origin ||
      (event.headers?.["x-forwarded-host"]
        ? `https://${event.headers["x-forwarded-host"]}`
        : null);
    
    // Remove baseUrl from productData if it was passed (not a product field)
    if (productData.baseUrl) {
      delete productData.baseUrl;
    }

    // Create product with QR code generation
    const product = await createProduct(productData, baseUrl);

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "create",
      entityType: "product",
      entityId: product.id,
      details: {
        productName: product.name,
        productId: product.id,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    return successResponse(product, 201);
  } catch (error) {
    console.error("Product Create Error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    });

    // Handle authentication errors
    if (error.message?.includes("Unauthorized") || error.message?.includes("Invalid token")) {
      return errorResponse({ message: error.message, error: "UnauthorizedError" }, 401);
    }

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

