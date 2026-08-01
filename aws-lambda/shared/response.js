/**
 * AWS Lambda - HTTP Response Helpers
 * 
 * This module provides helper functions for creating HTTP responses in Lambda functions.
 * 
 * Lambda functions return responses in a specific format:
 * {
 *   statusCode: 200,
 *   headers: { ... },
 *   body: JSON.stringify(data)
 * }
 * 
 * This is different from Vercel serverless functions which use Express-like req/res objects.
 */

/**
 * CORS headers for all responses
 * 
 * These headers allow your React frontend (hosted on Vercel) to call the Lambda API.
 * In production, you might want to restrict 'Access-Control-Allow-Origin' to your domain.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Create success response
 * 
 * @param {any} data - Data to return in response body
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {object} Lambda response object
 * 
 * Example:
 * return successResponse({ products: [...] }, 200);
 */
function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

/**
 * Create error response
 * 
 * @param {string|object} message - Error message or error object
 * @param {number} statusCode - HTTP status code (default: 400)
 * @returns {object} Lambda response object
 * 
 * Example:
 * return errorResponse('Product not found', 404);
 * return errorResponse({ message: 'Error', code: 'ERROR_CODE' }, 500);
 */
function errorResponse(message, statusCode = 400) {
  const errorBody = typeof message === 'string' 
    ? { message, error: message }
    : message;
    
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(errorBody),
  };
}

/**
 * Create response (unified helper for success and error)
 * 
 * @param {number} statusCode - HTTP status code
 * @param {any} data - Data to return in response body
 * @returns {object} Lambda response object
 * 
 * Example:
 * return createResponse(200, { products: [...] });
 * return createResponse(500, { error: 'Failed', message: 'Details' });
 */
function createResponse(statusCode, data) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 * 
 * When a browser makes a cross-origin request, it first sends an OPTIONS request
 * to check if the actual request is allowed. This function handles that.
 * 
 * @returns {object} Lambda response object for OPTIONS request
 */
function handleOptions() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: '',
  };
}

module.exports = {
  corsHeaders,
  successResponse,
  errorResponse,
  createResponse,
  handleOptions,
};

