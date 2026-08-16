'use strict';

/**
 * Wraps an async route handler so a rejected promise reaches the error
 * middleware instead of becoming an unhandled rejection.
 *
 * Express 5 already forwards rejections from async handlers, so this is
 * belt-and-braces. It is kept because it makes the intent explicit at every
 * call site and keeps handlers portable if you ever downgrade to Express 4 or
 * lift a controller into a project that has not migrated.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
