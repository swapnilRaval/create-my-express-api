'use strict';

/**
 * The one error type the application throws on purpose.
 *
 * `isOperational` distinguishes "the client did something invalid" from "a bug
 * escaped". Operational errors are safe to show to the caller; everything else
 * is reduced to a generic 500 in production so stack traces and driver
 * internals never leak.
 */
class ApiError extends Error {
  constructor(statusCode, message, { errors = [], isOperational = true, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, { errors });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists', errors = []) {
    return new ApiError(409, message, { errors });
  }

  static unprocessable(message = 'Validation failed', errors = []) {
    return new ApiError(422, message, { errors });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, { isOperational: false });
  }
}

module.exports = ApiError;
