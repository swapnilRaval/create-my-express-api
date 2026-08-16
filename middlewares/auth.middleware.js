'use strict';

/**
 * Authentication and authorisation.
 *
 * 401 means "we do not know who you are"; 403 means "we know, and you are not
 * allowed". Conflating them makes clients unable to decide whether to retry
 * with a refreshed token.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { verifyToken, extractBearerToken } = require('../helpers/jwt.helper');
const User = require('../models/user.model');

/** Requires a valid Bearer token and loads the matching active user. */
const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('Missing Authorization header. Expected: Bearer <token>');
  }

  const payload = verifyToken(token);

  // The token is only a claim - the user may have been deleted or deactivated
  // since it was issued, so every request re-checks the database.
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('The user for this token no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  req.user = user;
  req.token = token;
  return next();
});

/** Attaches req.user when a token is present, but never rejects. */
const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    }
  } catch {
    // Deliberately ignored: this middleware is best-effort.
  }
  return next();
});

/** Role gate. Must run after `authenticate`. */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This action requires one of: ${roles.join(', ')}`));
  }
  return next();
};

module.exports = { authenticate, optionalAuthenticate, authorize };
