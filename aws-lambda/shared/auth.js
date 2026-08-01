/**
 * AWS Lambda - Auth Helper Functions
 *
 * This module provides authentication utilities for Lambda functions.
 * Similar to lib/auth.js but adapted for Lambda environment.
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Get JWT secret from environment variable (set in template.yaml)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Generate JWT token for user
 *
 * @param {object} user - User object with id, email, name, role
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user", // Include role in token to avoid DynamoDB lookups
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Verify JWT token
 *
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Hash password
 *
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 *
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Extract token from Authorization header (HTTP API v2 format)
 *
 * @param {object} event - Lambda event object
 * @returns {string|null} Token or null if not found
 */
function extractToken(event) {
  const authHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    event.headers?.["authorization"];

  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

/**
 * Verify authentication from Lambda event (non-throwing version)
 *
 * @param {object} event - Lambda event object
 * @returns {object} Object with valid, userId, userEmail, userName, role, and error
 */
function verifyAuth(event) {
  const token = extractToken(event);
  if (!token) {
    return {
      valid: false,
      error: "No token provided",
    };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return {
      valid: false,
      error: "Invalid token",
    };
  }

  return {
    valid: true,
    userId: decoded.id,
    userEmail: decoded.email,
    userName: decoded.name,
    role: decoded.role || "user",
  };
}

/**
 * Verify authentication from Lambda event (throwing version)
 *
 * @param {object} event - Lambda event object
 * @returns {object} Decoded token
 * @throws {Error} If token is missing or invalid
 */
function requireAuth(event) {
  const token = extractToken(event);
  if (!token) {
    throw new Error("No token provided");
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    throw new Error("Invalid token");
  }

  return decoded;
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  extractToken,
  verifyAuth,
  requireAuth,
};
