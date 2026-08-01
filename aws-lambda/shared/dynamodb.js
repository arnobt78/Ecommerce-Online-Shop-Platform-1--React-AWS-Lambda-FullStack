/**
 * AWS Lambda - DynamoDB Client Setup
 *
 * This module creates and exports a DynamoDB client for use in Lambda functions.
 *
 * Key differences from Vercel serverless:
 * - Lambda functions use IAM roles for authentication (not access keys)
 * - Client is initialized once per Lambda execution context (reused across invocations)
 * - No need to handle credential trimming (IAM roles handle this)
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Get region from Lambda runtime environment (automatically set by AWS)
// Lambda automatically provides AWS_REGION in the runtime environment
const REGION = process.env.AWS_REGION || "eu-north-1";

/**
 * Create DynamoDB client
 *
 * In Lambda, we use IAM roles instead of access keys.
 * The Lambda execution role should have DynamoDB permissions.
 *
 * Benefits:
 * - More secure (no keys in code)
 * - Automatic credential rotation
 * - Better for production
 */
const client = new DynamoDBClient({
  region: REGION,
  // No credentials needed - Lambda execution role provides them
});

// Create DocumentClient for easier DynamoDB operations (handles marshalling/unmarshalling)
// Configure to automatically remove undefined values (DynamoDB doesn't allow undefined)
const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/**
 * DynamoDB Table Names
 *
 * These match your existing DynamoDB tables.
 * Make sure these tables exist in your AWS account (eu-north-1 region).
 */
const TABLES = {
  PRODUCTS: "codebook-products",
  // FEATURED_PRODUCTS: "codebook-featured-products", // REMOVED - featured products now use featured_product field in products table
  ORDERS: "codebook-orders",
  USERS: "codebook-users",
  ACTIVITY_LOG: "codebook-activity-log", // Activity log for admin actions
  TICKETS: "codebook-tickets", // Support tickets table
  REVIEWS: "codebook-reviews", // Product reviews table
};

module.exports = { dynamoDB, TABLES };
