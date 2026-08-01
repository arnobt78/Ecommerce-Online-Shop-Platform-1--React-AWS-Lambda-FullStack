/**
 * AWS Lambda Function: Product Delete
 *
 * This Lambda function handles DELETE requests to delete products.
 * Requires admin authentication.
 *
 * Endpoint: DELETE /admin/products/{id}
 */

const { deleteProduct, getProductById } = require("../../shared/products");
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
  console.log("Product Delete Lambda invoked:", JSON.stringify(event, null, 2));

  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  // Handle CORS preflight request
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow DELETE method
  if (httpMethod !== "DELETE") {
    return errorResponse("Method not allowed. Use DELETE.", 405);
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

    // Delete product
    await deleteProduct(productId);

    // Log activity (non-blocking - don't fail if logging fails)
    logActivity({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "delete",
      entityType: "product",
      entityId: productId,
      details: {
        productName: existingProduct.name,
        productId: productId,
      },
    }).catch((logError) => {
      console.error("Failed to log activity:", logError);
      // Don't throw - activity logging is non-critical
    });

    return successResponse({ message: "Product deleted successfully", id: productId }, 200);
  } catch (error) {
    console.error("Product Delete Error:", {
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

