'use strict';

/**
 * Rate limiting.
 *
 * Two buckets: a wide one for the API generally, and a much tighter one for the
 * credential endpoints, which are the ones worth brute-forcing. The default
 * store is in-memory, which means counters are per-process - behind more than
 * one instance, swap in the Redis store from express-rate-limit's docs.
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

const handler = (_req, _res, next) => {
  next(ApiError.tooManyRequests('Too many requests - please try again later'));
};

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Tests would otherwise trip the limiter and fail intermittently.
  skip: () => env.NODE_ENV === 'test',
  handler,
});

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  // Bucket by email as well as IP so one NAT gateway is not a shared quota,
  // and so one attacker cannot lock out an account by IP-hopping.
  keyGenerator: (req) => {
    const ipKey = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return email ? `${ipKey}:${email}` : ipKey;
  },
  handler,
});

module.exports = { apiLimiter, authLimiter };
