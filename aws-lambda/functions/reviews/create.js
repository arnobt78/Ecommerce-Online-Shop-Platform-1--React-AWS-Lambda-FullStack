/**
 * AWS Lambda - Create Product Review
 * POST /reviews
 *
 * Creates a new product review.
 * Requires authentication - user must have ordered the product.
 */

const { createResponse } = require("../../shared/response");
const { verifyAuth } = require("../../shared/auth");
const { createReview } = require("../../shared/reviews");
const { getOrderById } = require("../../shared/orders");

exports.handler = async (event) => {
  try {
    // Verify authentication
    const authResult = verifyAuth(event);
    if (!authResult.valid) {
      return createResponse(401, {
        error: "Unauthorized",
        message: authResult.error,
      });
    }

    const { userId, userEmail, userName } = authResult;

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return createResponse(400, {
        error: "Invalid JSON in request body",
      });
    }

    const { productId, orderId, rating, comment } = body;

    // Validate required fields
    if (!productId || !orderId || !rating || !comment) {
      return createResponse(400, {
        error: "Missing required fields: productId, orderId, rating, comment",
      });
    }

    // Verify that the order exists and belongs to the user
    const order = await getOrderById(orderId);
    if (!order) {
      return createResponse(404, {
        error: "Order not found",
      });
    }

    if (order.userId !== userId) {
      return createResponse(403, {
        error: "You can only review products from your own orders",
      });
    }

    // Verify that the product is in the order
    const productInOrder = order.cartList?.some(
      (item) => item.id === productId
    );
    if (!productInOrder) {
      return createResponse(400, {
        error: "This product is not in the specified order",
      });
    }

    // Verify that the order status allows reviews (delivered or completed orders)
    // For now, allow reviews for any order status (can be restricted later)
    // if (order.status !== "delivered") {
    //   return createResponse(400, {
    //     error: "You can only review products from delivered orders",
    //   });
    // }

    // Create the review
    const review = await createReview({
      productId,
      userId,
      orderId,
      rating,
      comment,
      userName: userName || order.user?.name || "Customer",
      userEmail: userEmail || order.user?.email || "",
    });

    return createResponse(201, {
      message: "Review created successfully",
      review,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return createResponse(500, {
      error: "Failed to create review",
      message: error.message,
    });
  }
};

