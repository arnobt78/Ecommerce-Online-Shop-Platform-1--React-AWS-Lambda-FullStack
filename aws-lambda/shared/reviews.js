/**
 * AWS Lambda - Reviews Helper Functions
 *
 * This module provides utilities for managing product reviews in DynamoDB.
 * Reviews allow customers who have purchased products to rate and review them.
 */

const { dynamoDB, TABLES } = require("./dynamodb");
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

// Lazy load uuid (ESM module) - will be imported when needed
let uuidModule = null;
async function getUuid() {
  if (!uuidModule) {
    uuidModule = await import("uuid");
  }
  const { v4: uuidv4 } = uuidModule;
  return uuidv4();
}

/**
 * Create a new product review
 *
 * @param {Object} reviewData - Review data
 * @param {string} reviewData.productId - Product ID
 * @param {string} reviewData.userId - User ID (customer who ordered)
 * @param {string} reviewData.orderId - Order ID (to verify purchase)
 * @param {number} reviewData.rating - Rating (1-5)
 * @param {string} reviewData.comment - Review comment
 * @param {string} reviewData.userName - User name
 * @param {string} reviewData.userEmail - User email
 * @returns {Promise<Object>} Created review object
 * @throws {Error} If validation fails or user hasn't ordered the product
 */
async function createReview(reviewData) {
  const {
    productId,
    userId,
    orderId,
    rating,
    comment,
    userName,
    userEmail,
  } = reviewData;

  // Validate required fields
  if (!productId || !userId || !orderId || !rating || !comment) {
    throw new Error(
      "Missing required fields: productId, userId, orderId, rating, comment"
    );
  }

  // Validate rating (1-5)
  const ratingNum = Number(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new Error("Rating must be a number between 1 and 5");
  }

  // Check if user has already reviewed this product
  const existingReviews = await getReviewsByProductAndUser(productId, userId);
  if (existingReviews.length > 0) {
    throw new Error("You have already reviewed this product");
  }

  // Generate review ID
  const reviewId = await getUuid();
  const now = new Date().toISOString();

  // Create review object
  const review = {
    id: reviewId,
    productId,
    userId,
    orderId,
    rating: ratingNum,
    comment: comment.trim(),
    userName: userName || "Customer",
    userEmail: userEmail || "",
    status: "approved", // approved, pending, rejected (for moderation)
    createdAt: now,
    updatedAt: now,
  };

  // Save to DynamoDB
  await dynamoDB.send(
    new PutCommand({
      TableName: TABLES.REVIEWS,
      Item: review,
    })
  );

  return review;
}

/**
 * Get review by ID
 *
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object|null>} Review object or null if not found
 */
async function getReviewById(reviewId) {
  const result = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.REVIEWS,
      Key: { id: reviewId },
    })
  );

  return result.Item || null;
}

/**
 * Get reviews by product ID
 *
 * @param {string} productId - Product ID
 * @param {string} status - Optional status filter (approved, pending, rejected)
 * @returns {Promise<Array>} Array of reviews
 */
async function getReviewsByProductId(productId, status = "approved") {
  try {
    console.log("🔍 [getReviewsByProductId] Starting query");
    console.log("🔍 [getReviewsByProductId] productId:", productId);
    console.log("🔍 [getReviewsByProductId] status:", status);
    console.log("🔍 [getReviewsByProductId] TableName:", TABLES.REVIEWS);
    console.log("🔍 [getReviewsByProductId] IndexName: productId-index");
    
    // Try to use GSI Query first (more efficient)
    // QueryCommand is already imported at the top
    
    // Build expression attribute names and values
    const expressionAttributeNames = {
      "#productId": "productId",
    };
    const expressionAttributeValues = {
      ":productId": productId,
    };

    // Add status filter if provided
    if (status) {
      expressionAttributeNames["#status"] = "status";
      expressionAttributeValues[":status"] = status;
    }

    console.log("🔍 [getReviewsByProductId] ExpressionAttributeNames:", expressionAttributeNames);
    console.log("🔍 [getReviewsByProductId] ExpressionAttributeValues:", expressionAttributeValues);

    const command = new QueryCommand({
      TableName: TABLES.REVIEWS,
      IndexName: "productId-index",
      KeyConditionExpression: "#productId = :productId",
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      // Filter by status if provided
      ...(status && {
        FilterExpression: "#status = :status",
      }),
    });

    console.log("🔍 [getReviewsByProductId] Sending QueryCommand...");
    const result = await dynamoDB.send(command);
    console.log("✅ [getReviewsByProductId] Query successful, items:", result.Items?.length || 0);
    return result.Items || [];
  } catch (error) {
    // Log the error for debugging
    console.error("❌ [getReviewsByProductId] Error querying reviews by productId:", error);
    console.error("❌ [getReviewsByProductId] Error name:", error.name);
    console.error("❌ [getReviewsByProductId] Error message:", error.message);
    console.error("❌ [getReviewsByProductId] Error stack:", error.stack);
    
    // Fallback to Scan if GSI doesn't exist yet or other query errors
    if (
      error.name === "ValidationException" ||
      error.name === "ResourceNotFoundException" ||
      error.name === "ResourceInUseException"
    ) {
      console.warn(
        '⚠️ [getReviewsByProductId] GSI "productId-index" not available. Using Scan (less efficient).'
      );
      try {
        const scanCommand = new ScanCommand({
          TableName: TABLES.REVIEWS,
          FilterExpression: "#productId = :productId",
          ExpressionAttributeNames: {
            "#productId": "productId",
          },
          ExpressionAttributeValues: {
            ":productId": productId,
          },
        });
        const scanResult = await dynamoDB.send(scanCommand);
        let reviews = scanResult.Items || [];

        // Filter by status if provided
        if (status) {
          reviews = reviews.filter((review) => review.status === status);
        }

        console.log("✅ [getReviewsByProductId] Scan successful, items:", reviews.length);
        return reviews;
      } catch (scanError) {
        console.error("❌ [getReviewsByProductId] Error scanning reviews:", scanError);
        console.error("❌ [getReviewsByProductId] Scan error name:", scanError.name);
        console.error("❌ [getReviewsByProductId] Scan error message:", scanError.message);
        throw scanError;
      }
    }
    // Re-throw with more context
    const enhancedError = new Error(
      `Failed to query reviews: ${error.message} (${error.name})`
    );
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Get reviews by user ID
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of reviews
 */
async function getReviewsByUserId(userId) {
  try {
    // Try to use GSI Query first (more efficient)
    const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
    const command = new QueryCommand({
      TableName: TABLES.REVIEWS,
      IndexName: "userId-index",
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    // Fallback to Scan if GSI doesn't exist yet
    if (
      error.name === "ValidationException" ||
      error.name === "ResourceNotFoundException"
    ) {
      console.warn(
        'GSI "userId-index" not found. Using Scan (less efficient). Create GSI to optimize.'
      );
      const scanCommand = new ScanCommand({
        TableName: TABLES.REVIEWS,
        FilterExpression: "#userId = :userId",
        ExpressionAttributeNames: {
          "#userId": "userId",
        },
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      });
      const scanResult = await dynamoDB.send(scanCommand);
      return scanResult.Items || [];
    }
    throw error;
  }
}

/**
 * Get reviews by product ID and user ID (to check if user already reviewed)
 *
 * @param {string} productId - Product ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of reviews (should be 0 or 1)
 */
async function getReviewsByProductAndUser(productId, userId) {
  try {
    // Try to use GSI Query first
    const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
    const command = new QueryCommand({
      TableName: TABLES.REVIEWS,
      IndexName: "productId-index",
      KeyConditionExpression: "#productId = :productId",
      FilterExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#productId": "productId",
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":productId": productId,
        ":userId": userId,
      },
    });

    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    // Log the error for debugging
    console.error("Error querying reviews by productId and userId:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    // Fallback to Scan if GSI doesn't exist yet or other query errors
    if (
      error.name === "ValidationException" ||
      error.name === "ResourceNotFoundException" ||
      error.name === "ResourceInUseException"
    ) {
      console.warn(
        'GSI "productId-index" not available. Using Scan (less efficient).'
      );
      try {
        const scanCommand = new ScanCommand({
          TableName: TABLES.REVIEWS,
          FilterExpression: "#productId = :productId AND #userId = :userId",
          ExpressionAttributeNames: {
            "#productId": "productId",
            "#userId": "userId",
          },
          ExpressionAttributeValues: {
            ":productId": productId,
            ":userId": userId,
          },
        });
        const scanResult = await dynamoDB.send(scanCommand);
        return scanResult.Items || [];
      } catch (scanError) {
        console.error("Error scanning reviews:", scanError);
        throw scanError;
      }
    }
    throw error;
  }
}

/**
 * Get all reviews (admin only)
 *
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} Array of all reviews
 */
async function getAllReviews(status = null) {
  const scanCommand = new ScanCommand({
    TableName: TABLES.REVIEWS,
    ...(status && {
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
      },
    }),
  });

  const result = await dynamoDB.send(scanCommand);
  return result.Items || [];
}

/**
 * Update review
 *
 * @param {string} reviewId - Review ID
 * @param {Object} updates - Fields to update (rating, comment, status)
 * @returns {Promise<Object>} Updated review
 */
async function updateReview(reviewId, updates) {
  // Build update expression dynamically
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  // Validate rating if provided
  if (updates.rating !== undefined) {
    const ratingNum = Number(updates.rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw new Error("Rating must be a number between 1 and 5");
    }
    updateExpressions.push("#rating = :rating");
    expressionAttributeNames["#rating"] = "rating";
    expressionAttributeValues[":rating"] = ratingNum;
  }

  if (updates.comment !== undefined) {
    // "comment" is a reserved keyword in DynamoDB, must use ExpressionAttributeNames
    updateExpressions.push("#comment = :comment");
    expressionAttributeNames["#comment"] = "comment";
    expressionAttributeValues[":comment"] = updates.comment.trim();
  }

  if (updates.status !== undefined) {
    const validStatuses = ["approved", "pending", "rejected"];
    if (!validStatuses.includes(updates.status)) {
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }
    updateExpressions.push("#status = :status");
    expressionAttributeNames["#status"] = "status";
    expressionAttributeValues[":status"] = updates.status;
  }

  // Always update updatedAt (also a reserved keyword, must escape)
  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  if (updateExpressions.length === 0) {
    throw new Error("No valid fields to update");
  }

  const command = new UpdateCommand({
    TableName: TABLES.REVIEWS,
    Key: { id: reviewId },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    // Always include ExpressionAttributeNames (required when using #placeholder)
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  });

  const result = await dynamoDB.send(command);
  return result.Attributes;
}

/**
 * Delete review
 *
 * @param {string} reviewId - Review ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteReview(reviewId) {
  const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
  const command = new DeleteCommand({
    TableName: TABLES.REVIEWS,
    Key: { id: reviewId },
  });

  await dynamoDB.send(command);
  return true;
}

/**
 * Calculate average rating for a product
 *
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Object with averageRating and reviewCount
 */
async function getProductRatingStats(productId) {
  const reviews = await getReviewsByProductId(productId, "approved");

  if (reviews.length === 0) {
    return {
      averageRating: 0,
      reviewCount: 0,
    };
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  return {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    reviewCount: reviews.length,
  };
}

module.exports = {
  createReview,
  getReviewById,
  getReviewsByProductId,
  getReviewsByUserId,
  getReviewsByProductAndUser,
  getAllReviews,
  updateReview,
  deleteReview,
  getProductRatingStats,
};

