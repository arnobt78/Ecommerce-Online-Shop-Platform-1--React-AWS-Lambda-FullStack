/**
 * AWS Lambda - Orders Helper Functions
 *
 * This module provides order management utilities for Lambda functions.
 * Similar to lib/orders.js but adapted for Lambda environment.
 */

const { dynamoDB, TABLES } = require("./dynamodb");
const { QueryCommand, PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { decrementProductStock, incrementProductStock } = require("./products");

// Lazy load uuid (ESM module) - will be imported when needed
let uuidModule = null;
async function getUuid() {
  if (!uuidModule) {
    uuidModule = await import("uuid");
  }
  // v4 is a function, we need to call it to generate UUID
  const { v4: uuidv4 } = uuidModule;
  return uuidv4();
}

/**
 * Get orders by user ID
 *
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Array>} Array of orders
 *
 * IMPORTANT: This function tries to use Query with a GSI for efficiency.
 * If the GSI doesn't exist, it falls back to Scan (less efficient but works).
 *
 * To optimize: Create a GSI named 'userId-index' with partition key 'userId'
 * This will reduce read capacity usage by 80-90%!
 */
async function getOrdersByUserId(userId) {
  // Try Query first (efficient - only reads matching items)
  // This requires a GSI named 'userId-index' on the 'userId' attribute
  try {
    const queryCommand = new QueryCommand({
      TableName: TABLES.ORDERS,
      IndexName: "userId-index", // GSI name - create this in DynamoDB console
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const result = await dynamoDB.send(queryCommand);
    return result.Items || [];
  } catch (error) {
    // Fallback to Scan if GSI doesn't exist yet
    // Scan is less efficient but will work until GSI is created
    if (
      error.name === "ValidationException" ||
      error.name === "ResourceNotFoundException"
    ) {
      console.warn(
        'GSI "userId-index" not found. Using Scan (less efficient). Create GSI to optimize.'
      );
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const scanCommand = new ScanCommand({
        TableName: TABLES.ORDERS,
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
 * Create new order
 *
 * @param {object} orderData - Order data { cartList, amount_paid, quantity, user }
 * @returns {Promise<Object>} Created order
 * @throws {Error} If validation fails
 */
async function createOrder(orderData) {
  try {
    const { cartList, amount_paid, quantity, user } = orderData;

    // Validate required fields
    if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
      throw new Error("Cart list is required and must not be empty");
    }
    if (!user || !user.id) {
      throw new Error("User information is required");
    }

    // Generate UUID for order ID
    const orderId = await getUuid();

    // Clean cartList to remove undefined values
    const cleanCartList = cartList.map((item) => {
      const cleanItem = {};
      // Only include defined values
      Object.keys(item).forEach((key) => {
        if (item[key] !== undefined) {
          cleanItem[key] = item[key];
        }
      });
      return cleanItem;
    });

    // Decrement product stock for each item in cart (before creating order)
    // This ensures stock is reserved when order is created
    // Note: Stock updates use ConditionExpression to prevent race conditions
    // If order creation fails after stock is decremented, stock will be incorrect until order is cancelled/refunded
    // For production, consider using DynamoDB Transactions for atomic order+stock updates
    const stockUpdateResults = [];
    const stockUpdatesToRollback = []; // Track successful stock updates for potential rollback
    
    for (const item of cleanCartList) {
      if (item.id && item.quantity) {
        try {
          console.log(`🛒 Processing stock decrement for order item:`, {
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
          });
          
          const updatedProduct = await decrementProductStock(item.id, item.quantity);
          
          console.log(`✅ Stock decremented for order item:`, {
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            oldStock: updatedProduct.stock + item.quantity, // Calculate old stock
            newStock: updatedProduct.stock,
            shouldTriggerLowStockAlert: updatedProduct._shouldTriggerLowStockAlert,
            lowStockThreshold: updatedProduct._lowStockThreshold,
          });
          
          stockUpdateResults.push({
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            newStock: updatedProduct.stock,
            success: true,
            shouldTriggerLowStockAlert: updatedProduct._shouldTriggerLowStockAlert || false,
            lowStockThreshold: updatedProduct._lowStockThreshold,
          });
          // Track for potential rollback if order creation fails
          stockUpdatesToRollback.push({
            productId: item.id,
            quantity: item.quantity,
          });
        } catch (stockError) {
          // If stock update fails, log error but continue with other products
          // This allows partial stock updates (some products might not have stock tracking)
          console.error(`Failed to update stock for product ${item.id}:`, stockError.message);
          stockUpdateResults.push({
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            success: false,
            error: stockError.message,
          });
          // If stock validation fails (insufficient stock), rollback any successful updates and throw error
          if (stockError.message.includes("Insufficient stock") || stockError.message.includes("ConditionalCheckFailedException")) {
            // Rollback successful stock updates
            for (const rollback of stockUpdatesToRollback) {
              try {
                await incrementProductStock(rollback.productId, rollback.quantity);
                console.log(`Rolled back stock for product ${rollback.productId}`);
              } catch (rollbackError) {
                console.error(`Failed to rollback stock for product ${rollback.productId}:`, rollbackError.message);
                // Log but don't throw - rollback failures are logged for manual intervention
              }
            }
            throw stockError;
          }
        }
      }
    }

    const order = {
      id: orderId,
      userId: user.id,
      cartList: cleanCartList,
      amount_paid: Number(amount_paid) || 0,
      quantity: Number(quantity) || 0,
      user: {
        name: user.name || "",
        email: user.email || "",
        id: user.id,
      },
      // Include payment information if provided
      ...(orderData.paymentIntentId && { paymentIntentId: orderData.paymentIntentId }),
      ...(orderData.paymentStatus && { paymentStatus: orderData.paymentStatus }),
      status: orderData.status || "pending", // Order status (pending, processing, shipped, delivered, cancelled)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: TABLES.ORDERS,
      Item: order,
    });

    try {
      await dynamoDB.send(command);
    } catch (orderError) {
      // If order creation fails after stock is decremented, rollback stock changes
      console.error("Order creation failed, rolling back stock updates:", orderError.message);
      for (const rollback of stockUpdatesToRollback) {
        try {
          await incrementProductStock(rollback.productId, rollback.quantity);
          console.log(`Rolled back stock for product ${rollback.productId}`);
        } catch (rollbackError) {
          console.error(`Failed to rollback stock for product ${rollback.productId}:`, rollbackError.message);
          // Log but don't throw - rollback failures are logged for manual intervention
        }
      }
      throw orderError; // Re-throw to be caught by outer catch
    }

    // Log stock updates for debugging
    console.log("📦 Stock updated for order:", {
      orderId,
      stockUpdates: stockUpdateResults,
      totalItems: cleanCartList.length,
      itemsProcessed: stockUpdateResults.length,
      successfulUpdates: stockUpdateResults.filter(s => s.success).length,
      failedUpdates: stockUpdateResults.filter(s => !s.success).length,
    });

    // Check for low stock alerts and include in response for frontend to send emails
    // Frontend will handle sending low stock emails (similar to out-of-stock emails)
    const lowStockAlerts = stockUpdateResults
      .filter(update => update.shouldTriggerLowStockAlert && update.success)
      .map(update => ({
        productId: update.productId,
        productName: update.productName,
        currentStock: update.newStock,
        lowStockThreshold: update.lowStockThreshold,
      }));

    if (lowStockAlerts.length > 0) {
      console.log("⚠️ Low stock alerts detected:", {
        orderId,
        lowStockAlerts,
        count: lowStockAlerts.length,
      });
    }

    // Include stock update results in order response for frontend to check out-of-stock products
    // Frontend can use this to send out-of-stock alerts and low stock alerts
    return {
      ...order,
      _stockUpdates: stockUpdateResults, // Internal field for frontend use
      _lowStockAlerts: lowStockAlerts, // Internal field for frontend to send low stock emails
    };
  } catch (error) {
    console.error("createOrder error:", error);
    throw new Error(`Failed to create order: ${error.message}`);
  }
}

/**
 * Get all orders (admin only)
 * 
 * @returns {Promise<Array>} Array of all orders
 * 
 * Note: This uses Scan which is less efficient but necessary for admin view.
 * For production, consider pagination or date-based filtering.
 */
async function getAllOrders() {
  const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
  const scanCommand = new ScanCommand({
    TableName: TABLES.ORDERS,
  });
  
  const result = await dynamoDB.send(scanCommand);
  return result.Items || [];
}

/**
 * Get order by ID
 * 
 * @param {string} orderId - Order ID (UUID)
 * @returns {Promise<Object|null>} Order object or null if not found
 * 
 * Uses GetCommand (most efficient - single item read by primary key)
 */
async function getOrderById(orderId) {
  const command = new GetCommand({
    TableName: TABLES.ORDERS,
    Key: { id: orderId },
  });

  const result = await dynamoDB.send(command);
  if (!result.Item) return null;

  return result.Item;
}

/**
 * Update order status
 * 
 * @param {string} orderId - Order ID (UUID)
 * @param {string} status - New status (pending, processing, shipped, delivered, cancelled)
 * @returns {Promise<Object>} Updated order
 * @throws {Error} If order not found or update fails
 * 
 * Uses UpdateCommand (efficient - only updates specified attribute)
 * Automatically restores product stock when order is cancelled
 */
async function updateOrderStatus(orderId, status) {
  // Validate status
  const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  // Check if order exists first
  const existingOrder = await getOrderById(orderId);
  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const previousStatus = existingOrder.status;

  // Track stock restore results for cancelled orders (to include in response)
  let stockRestoreResults = [];

  // If order is being cancelled, restore product stock
  if (status === "cancelled" && previousStatus !== "cancelled" && existingOrder.cartList) {
    for (const item of existingOrder.cartList) {
      if (item.id && item.quantity) {
        try {
          console.log(`🔄 Restoring stock for cancelled order item:`, {
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
          });
          
          const updatedProduct = await incrementProductStock(item.id, item.quantity);
          
          console.log(`✅ Stock restored for cancelled order item:`, {
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            oldStock: updatedProduct.stock - item.quantity, // Calculate old stock
            newStock: updatedProduct.stock,
          });
          
          stockRestoreResults.push({
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            newStock: updatedProduct.stock,
            success: true,
          });
        } catch (stockError) {
          // Log error but continue with other products
          console.error(`Failed to restore stock for product ${item.id}:`, stockError.message);
          stockRestoreResults.push({
            productId: item.id,
            productName: item.name || item.productName || "Product",
            quantity: item.quantity,
            success: false,
            error: stockError.message,
          });
        }
      }
    }
    console.log("📦 Stock restored for cancelled order:", {
      orderId,
      stockRestores: stockRestoreResults,
      totalItems: existingOrder.cartList?.length || 0,
      itemsProcessed: stockRestoreResults.length,
      successfulRestores: stockRestoreResults.filter(s => s.success).length,
      failedRestores: stockRestoreResults.filter(s => !s.success).length,
    });
  }

  // Update order status using UpdateCommand (efficient - only updates status field)
  const command = new UpdateCommand({
    TableName: TABLES.ORDERS,
    Key: { id: orderId },
    UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#status": "status", // 'status' is a reserved word in DynamoDB
    },
    ExpressionAttributeValues: {
      ":status": status,
      ":updatedAt": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW", // Return updated item
  });

  const result = await dynamoDB.send(command);
  const updatedOrder = result.Attributes;

  // Include stock restore results in order response for frontend (if order was cancelled)
  if (status === "cancelled" && stockRestoreResults && stockRestoreResults.length > 0) {
    return {
      ...updatedOrder,
      _stockRestores: stockRestoreResults, // Internal field for frontend use
    };
  }

  return updatedOrder;
}

/**
 * Update order tracking information
 * 
 * Dynamically builds UpdateExpression to only update provided fields.
 * Supports partial updates (only trackingNumber, or only status, etc.).
 * 
 * @param {string} orderId - Order ID (UUID)
 * @param {Object} trackingData - Tracking data object
 *   - trackingNumber: string (optional) - Tracking number
 *   - trackingCarrier: string (optional) - Carrier name (e.g., "usps", "ups")
 *   - labelUrl: string (optional) - URL to download shipping label PDF
 *   - status: string (optional) - Order status to update (e.g., "shipped")
 * @returns {Promise<Object>} Updated order object with all fields
 * @throws {Error} If order not found or update fails
 * 
 * Example:
 *   await updateOrderTracking("order-id", {
 *     trackingNumber: "9400111899223197428490",
 *     trackingCarrier: "usps",
 *     labelUrl: "https://...",
 *     status: "shipped"
 *   });
 */
async function updateOrderTracking(orderId, trackingData) {
  const { trackingNumber, trackingCarrier, labelUrl, status } = trackingData;

  // Check if order exists first
  const existingOrder = await getOrderById(orderId);
  if (!existingOrder) {
    throw new Error("Order not found");
  }

  // Build update expression dynamically
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  // Always update trackingNumber if provided (even if it's a test tracking number)
  // This ensures test mode works properly
  if (trackingNumber !== undefined && trackingNumber !== null) {
    updateExpressions.push("#trackingNumber = :trackingNumber");
    expressionAttributeNames["#trackingNumber"] = "trackingNumber";
    expressionAttributeValues[":trackingNumber"] = trackingNumber;
  }

  if (trackingCarrier) {
    updateExpressions.push("trackingCarrier = :trackingCarrier");
    expressionAttributeValues[":trackingCarrier"] = trackingCarrier;
  }

  if (labelUrl) {
    updateExpressions.push("labelUrl = :labelUrl");
    expressionAttributeValues[":labelUrl"] = labelUrl;
  }

  if (status) {
    updateExpressions.push("#status = :status");
    expressionAttributeNames["#status"] = "status";
    expressionAttributeValues[":status"] = status;
  }

  // Always update updatedAt
  updateExpressions.push("updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  // Update order using UpdateCommand
  const command = new UpdateCommand({
    TableName: TABLES.ORDERS,
    Key: { id: orderId },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW", // Return updated item
  });

  const result = await dynamoDB.send(command);
  return result.Attributes;
}

module.exports = {
  getOrdersByUserId,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderTracking,
};
