'use strict';

/**
 * Catch-all for unmatched routes.
 *
 * Registered with `app.use(notFound)` and no path string: Express 5 replaced
 * path-to-regexp v0 with v8, where a bare '*' is no longer a valid path
 * pattern. Mounting without a path matches everything and is version-proof.
 */

const ApiError = require('../utils/apiError');

module.exports = function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};
