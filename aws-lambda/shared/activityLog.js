/**
 * AWS Lambda - Activity Log Helper Functions
 *
 * This module provides activity logging utilities for tracking admin actions.
 * All admin actions (order status changes, product CRUD, user CRUD) are logged here.
 */

const { dynamoDB, TABLES } = require("./dynamodb");
const { PutCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

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
 * Log an activity to the activity log table
 *
 * @param {Object} activityData - Activity data
 * @param {string} activityData.userId - User ID who performed the action (admin)
 * @param {string} activityData.userEmail - User email (for display)
 * @param {string} activityData.userName - User name (for display)
 * @param {string} activityData.action - Action type (create, update, delete, status_change)
 * @param {string} activityData.entityType - Entity type (order, product, user)
 * @param {string} activityData.entityId - Entity ID (UUID)
 * @param {Object} activityData.details - Additional details (status change, field updates, etc.)
 * @returns {Promise<Object>} Created activity log entry
 */
async function logActivity(activityData) {
  try {
    const {
      userId,
      userEmail,
      userName,
      action,
      entityType,
      entityId,
      details = {},
    } = activityData;

    // Validate required fields
    if (!userId || !action || !entityType || !entityId) {
      console.warn("Activity log: Missing required fields", activityData);
      return null; // Don't throw - logging is non-critical
    }

    // Generate activity log ID
    const activityId = await getUuid();

    const activityLog = {
      id: activityId,
      userId,
      userEmail: userEmail || null,
      userName: userName || null,
      action, // create, update, delete, status_change
      entityType, // order, product, user
      entityId,
      details: JSON.stringify(details), // Store as JSON string for DynamoDB
      createdAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: TABLES.ACTIVITY_LOG,
      Item: activityLog,
    });

    await dynamoDB.send(command);

    console.log("✅ Activity logged:", {
      id: activityId,
      action,
      entityType,
      entityId,
      userId,
    });

    return activityLog;
  } catch (error) {
    // Don't throw - activity logging is non-critical
    // If logging fails, we don't want to break the main operation
    console.error("❌ Failed to log activity:", {
      error: error.message,
      activityData,
    });
    return null;
  }
}

/**
 * Get all activity logs (admin only)
 *
 * @param {Object} options - Query options
 * @param {string} options.entityType - Filter by entity type (optional)
 * @param {string} options.action - Filter by action (optional)
 * @param {string} options.userId - Filter by user ID (optional)
 * @param {number} options.limit - Limit results (optional, default: 100)
 * @returns {Promise<Array>} Array of activity logs
 */
async function getAllActivityLogs(options = {}) {
  const { entityType, action, userId, limit = 100 } = options;

  try {
    // Try to use GSI Query if userId is provided (more efficient)
    if (userId) {
      try {
        const queryCommand = new QueryCommand({
          TableName: TABLES.ACTIVITY_LOG,
          IndexName: "userId-index", // GSI name - create this in DynamoDB console
          KeyConditionExpression: "#userId = :userId",
          ExpressionAttributeNames: {
            "#userId": "userId",
          },
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          Limit: limit,
          ScanIndexForward: false, // Sort by createdAt descending (newest first)
        });

        const result = await dynamoDB.send(queryCommand);
        let logs = result.Items || [];

        // Apply additional filters if provided
        if (entityType) {
          logs = logs.filter((log) => log.entityType === entityType);
        }
        if (action) {
          logs = logs.filter((log) => log.action === action);
        }

        // Parse details JSON string back to object
        logs = logs.map((log) => {
          try {
            log.details = log.details ? JSON.parse(log.details) : {};
          } catch {
            log.details = {};
          }
          return log;
        });

        // Sort by createdAt descending (most recent first)
        return logs.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
      } catch (gsiError) {
        // Fallback to Scan if GSI doesn't exist yet
        if (
          gsiError.name === "ValidationException" ||
          gsiError.name === "ResourceNotFoundException"
        ) {
          console.warn(
            'GSI "userId-index" not found. Using Scan (less efficient). Create GSI to optimize.'
          );
          // Continue to Scan fallback below
        } else {
          throw gsiError;
        }
      }
    }

    // Build filter expression if filters provided
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (entityType) {
      filterExpressions.push("entityType = :entityType");
      expressionAttributeValues[":entityType"] = entityType;
    }

    if (action) {
      filterExpressions.push("#action = :action");
      expressionAttributeNames["#action"] = "action";
      expressionAttributeValues[":action"] = action;
    }

    if (userId) {
      filterExpressions.push("userId = :userId");
      expressionAttributeValues[":userId"] = userId;
    }

    const scanCommand = new ScanCommand({
      TableName: TABLES.ACTIVITY_LOG,
      ...(filterExpressions.length > 0 && {
        FilterExpression: filterExpressions.join(" AND "),
        ExpressionAttributeNames:
          Object.keys(expressionAttributeNames).length > 0
            ? expressionAttributeNames
            : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
      Limit: limit,
    });

    const result = await dynamoDB.send(scanCommand);
    const logs = (result.Items || []).map((log) => {
      // Parse details JSON string back to object
      try {
        log.details = log.details ? JSON.parse(log.details) : {};
      } catch {
        log.details = {};
      }
      return log;
    });

    // Sort by createdAt descending (most recent first)
    return logs.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  } catch (error) {
    console.error("Failed to get activity logs:", error);
    throw error;
  }
}

module.exports = {
  logActivity,
  getAllActivityLogs,
};

