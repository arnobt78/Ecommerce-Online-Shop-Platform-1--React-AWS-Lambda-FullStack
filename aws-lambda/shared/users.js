/**
 * AWS Lambda - Users Helper Functions
 *
 * This module provides user management utilities for Lambda functions.
 * Similar to lib/users.js but adapted for Lambda environment.
 */

const { dynamoDB, TABLES } = require("./dynamodb");
const {
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { hashPassword, comparePassword } = require("./auth");

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
 * Get user by ID
 *
 * @param {string} id - User ID (UUID)
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserById(id) {
  const command = new GetCommand({
    TableName: TABLES.USERS,
    Key: { id: id },
  });

  const result = await dynamoDB.send(command);
  if (!result.Item) return null;

  // Don't return password
  const { password, ...user } = result.Item;

  // Ensure role exists (default to 'user' for backward compatibility)
  if (!user.role) {
    user.role = "user";
  }

  return user;
}

/**
 * Get user by email
 *
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null if not found
 *
 * Optimized to use Query with GSI (email-index) for efficiency.
 * Falls back to Scan if GSI doesn't exist yet.
 */
async function getUserByEmail(email) {
  // Try Query first (efficient - only reads matching items)
  // This requires a GSI named 'email-index' on the 'email' attribute
  try {
    const queryCommand = new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: "email-index", // GSI name - create this in DynamoDB console
      KeyConditionExpression: "#email = :email",
      ExpressionAttributeNames: {
        "#email": "email",
      },
      ExpressionAttributeValues: {
        ":email": email,
      },
    });

    const result = await dynamoDB.send(queryCommand);
    const user = result.Items?.[0] || null;

    // Ensure role exists (default to 'user' for backward compatibility)
    if (user && !user.role) {
      user.role = "user";
    }

    return user;
  } catch (error) {
    // Fallback to Scan if GSI doesn't exist yet
    // Scan is less efficient but will work until GSI is created
    if (
      error.name === "ValidationException" ||
      error.name === "ResourceNotFoundException"
    ) {
      console.warn(
        'GSI "email-index" not found. Using Scan (less efficient). Create GSI to optimize.'
      );
      const scanCommand = new ScanCommand({
        TableName: TABLES.USERS,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      });

      const result = await dynamoDB.send(scanCommand);
      const user = result.Items?.[0] || null;

      // Ensure role exists (default to 'user' for backward compatibility)
      if (user && !user.role) {
        user.role = "user";
      }

      return user;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Create new user
 *
 * @param {object} userData - User data { email, password, name }
 * @returns {Promise<Object>} User object without password
 * @throws {Error} If user already exists
 */
async function createUser(userData) {
  const { email, password, name } = userData;

  // Check if user exists
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error("User already exists");
  }

  // Generate UUID for user ID
  const userId = await getUuid();

  // Hash password
  const hashedPassword = await hashPassword(password);

  const user = {
    id: userId,
    email,
    name,
    password: hashedPassword,
    role: "user", // Default role for all new registrations
    notificationsReadAt: null, // Timestamp when user last read notifications
    createdAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: TABLES.USERS,
    Item: user,
  });

  await dynamoDB.send(command);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Verify user credentials
 *
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object|null>} User object without password or null if invalid
 */
async function verifyUser(email, password) {
  const user = await getUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    return null;
  }

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;

  // Ensure role exists (default to 'user' for backward compatibility)
  if (!userWithoutPassword.role) {
    userWithoutPassword.role = "user";
  }

  return userWithoutPassword;
}

/**
 * Get all users (admin only)
 *
 * @returns {Promise<Array>} Array of all users (without passwords)
 *
 * Optimized to use ProjectionExpression to only fetch needed fields,
 * reducing data transfer and RCU consumption.
 *
 * Note: This uses Scan which is necessary for admin view.
 * For very large tables (>1000 users), consider pagination.
 */
async function getAllUsers() {
  const scanCommand = new ScanCommand({
    TableName: TABLES.USERS,
    // Only fetch fields we need - reduces data transfer and RCU
    // Both 'name' and 'role' are reserved words in DynamoDB, so we use aliases
    ProjectionExpression: "id, email, #name, #role, createdAt",
    ExpressionAttributeNames: {
      "#name": "name", // 'name' is a reserved word in DynamoDB
      "#role": "role", // 'role' is also a reserved word in DynamoDB
    },
  });

  const result = await dynamoDB.send(scanCommand);
  const users = (result.Items || []).map((user) => {
    // Ensure role exists (default to 'user' for backward compatibility)
    // Note: DynamoDB returns the attribute as 'role' even though we used #role in projection
    if (!user.role) {
      user.role = "user";
    }
    return user;
  });

  return users;
}

/**
 * Update user (admin only)
 * 
 * @param {string} userId - User ID (UUID)
 * @param {object} updates - Fields to update { name, email, role }
 * @returns {Promise<Object>} Updated user (without password)
 * @throws {Error} If user not found or update fails
 * 
 * Uses UpdateCommand (efficient - only updates specified fields)
 * Note: Password updates should use a separate endpoint with hashing
 */
async function updateUser(userId, updates) {
  // Check if user exists first
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw new Error("User not found");
  }

  // Build update expression dynamically based on provided fields
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  // Only update fields that are provided
  if (updates.name !== undefined) {
    updateExpressions.push("#name = :name");
    expressionAttributeNames["#name"] = "name";
    expressionAttributeValues[":name"] = updates.name;
  }

  if (updates.email !== undefined) {
    // Check if email is already taken by another user
    const userWithEmail = await getUserByEmail(updates.email);
    if (userWithEmail && userWithEmail.id !== userId) {
      throw new Error("Email already in use");
    }
    updateExpressions.push("email = :email");
    expressionAttributeValues[":email"] = updates.email;
  }

  if (updates.role !== undefined) {
    // Validate role
    const validRoles = ["user", "admin"];
    if (!validRoles.includes(updates.role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }
    updateExpressions.push("#role = :role");
    expressionAttributeNames["#role"] = "role";
    expressionAttributeValues[":role"] = updates.role;
  }

  if (updates.notificationsReadAt !== undefined) {
    updateExpressions.push("notificationsReadAt = :notificationsReadAt");
    expressionAttributeValues[":notificationsReadAt"] = updates.notificationsReadAt;
  }

  if (updateExpressions.length === 0) {
    // No fields to update, return existing user
    return existingUser;
  }

  // Add updatedAt timestamp
  updateExpressions.push("updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();

  // Update user using UpdateCommand (efficient - only updates specified fields)
  const command = new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { id: userId },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW", // Return updated item
  });

  const result = await dynamoDB.send(command);
  
  // Remove password from returned user
  const { password: _, ...userWithoutPassword } = result.Attributes;
  return userWithoutPassword;
}

/**
 * Delete user (admin only)
 * 
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object>} Deletion confirmation
 * @throws {Error} If user not found or deletion fails
 * 
 * Uses DeleteCommand (efficient - single item delete by primary key)
 */
async function deleteUser(userId) {
  // Check if user exists first
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw new Error("User not found");
  }

  // Delete user using DeleteCommand (efficient - single item delete)
  const command = new DeleteCommand({
    TableName: TABLES.USERS,
    Key: { id: userId },
  });

  await dynamoDB.send(command);
  
  return {
    message: "User deleted successfully",
    id: userId,
  };
}

module.exports = {
  getUserById,
  getUserByEmail,
  createUser,
  verifyUser,
  getAllUsers,
  updateUser,
  deleteUser,
};
