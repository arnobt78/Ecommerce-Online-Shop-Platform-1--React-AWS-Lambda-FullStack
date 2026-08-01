/**
 * AWS Lambda Function: Product Update
 *
 * This Lambda function handles PUT requests to update existing products.
 * Requires admin authentication.
 *
 * Endpoint: PUT /admin/products/{id}
 *
 * Request Body:
 * {
 *   "name": "Updated Name",
 *   "price": 39.99,
 *   "in_stock": false,
 *   ... (any fields to update)
 * }
 */

const { updateProduct, getProductById } = require("../../shared/products");
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
  console.log("Product Update Lambda invoked:", JSON.stringify(event, null, 2));

  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  // Handle CORS preflight request
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow PUT method
  if (httpMethod !== "PUT") {
    return errorResponse("Method not allowed. Use PUT.", 405);
  }

  try {
    // Require admin authentication
    const user = await requireAuth(event);

    // Extract product ID from path parameters
    const productId = event.pathParameters?.id || event.pathParameters?.productId;
    if (!productId) {
      return errorResponse("Product ID is required in path", 400);
    }

    // Check if product exists
    const existingProduct = await getProductById(productId);
    if (!existingProduct) {
      return errorResponse("Product not found", 404);
    }

    // Parse request body
    let updates;
    try {
      updates = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Debug logging to verify updates being received
    console.log("📥 Product Update Lambda - Received updates:", {
      productId,
      updates,
      stock: updates.stock,
      stockType: typeof updates.stock,
      lowStockThreshold: updates.lowStockThreshold,
      lowStockThresholdType: typeof updates.lowStockThreshold,
    });

    // Get base URL from multiple sources (priority order):
    // 1. BASE_URL environment variable (set in Lambda/Vercel)
    // 2. baseUrl from request body (frontend can pass REACT_APP_BASE_URL)
    // 3. Origin header from request
    // 4. x-forwarded-host header
    // 5. null (no QR code generation)
    const baseUrl =
      process.env.BASE_URL ||
      updates.baseUrl ||
      event.headers?.origin ||
      (event.headers?.["x-forwarded-host"]
        ? `https://${event.headers["x-forwarded-host"]}`
        : null);
    
    // Remove baseUrl from updates if it was passed (not a product field)
    if (updates.baseUrl) {
      delete updates.baseUrl;
    }

    // Update product (will auto-generate QR code if missing)
    const updatedProduct = await updateProduct(productId, updates, baseUrl);

    // Debug logging to verify updated product being returned
    console.log("📤 Product Update Lambda - Returning updated product:", {
      productId,
      updatedProduct,
      stock: updatedProduct?.stock,
      stockType: typeof updatedProduct?.stock,
      lowStockThreshold: updatedProduct?.lowStockThreshold,
      lowStockThresholdType: typeof updatedProduct?.lowStockThreshold,
    });

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "update",
      entityType: "product",
      entityId: productId,
      details: {
        productName: updatedProduct.name,
        productId: productId,
        updatedFields: Object.keys(updates),
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    return successResponse(updatedProduct, 200);
  } catch (error) {
    console.error("Product Update Error:", {
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

