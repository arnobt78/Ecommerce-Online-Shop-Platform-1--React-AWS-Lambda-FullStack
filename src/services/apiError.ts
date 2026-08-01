/**
 * API Error Class
 *
 * Custom error class that maintains compatibility with existing error handling
 * while satisfying ESLint's no-throw-literal rule.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.message = message;

    // Maintain compatibility with existing error handling
    // Existing code expects { message, status } structure
    Object.defineProperty(this, "message", {
      enumerable: true,
      value: message,
    });
    Object.defineProperty(this, "status", {
      enumerable: true,
      value: status,
    });
  }

  // Make it work with existing error handling that checks error.message and error.status
  toJSON() {
    return {
      message: this.message,
      status: this.status,
    };
  }
}
