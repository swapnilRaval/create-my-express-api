'use strict';

/**
 * JWT signing and verification.
 *
 * The payload carries the user id and role and nothing else. No password, no
 * email, no PII: a JWT is signed, not encrypted, and anyone holding the token
 * can read its contents with a base64 decode.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

const ISSUER = 'smoke-test';

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id ?? user.id), role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, issuer: ISSUER },
  );
}

/** Throws an ApiError (401) rather than a raw jsonwebtoken error. */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Token has expired');
    if (err.name === 'JsonWebTokenError') throw ApiError.unauthorized('Invalid token');
    throw ApiError.unauthorized('Token could not be verified');
  }
}

/** Pulls the credential out of `Authorization: Bearer <token>`, case-insensitively. */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

module.exports = { signAccessToken, verifyToken, extractBearerToken };
