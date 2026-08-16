'use strict';

/**
 * Server-rendered landing page. Exists to prove the EJS view layer is wired up
 * end to end; delete it (and views/index.ejs) if this API is JSON-only.
 */

const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const index = asyncHandler(async (_req, res) => {
  res.render('index', {
    title: 'smoke-test',
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    endpoints: [
      { method: 'GET', path: '/health', description: 'Liveness probe' },
      { method: 'POST', path: '/api/auth/register', description: 'Create an account' },
      { method: 'POST', path: '/api/auth/login', description: 'Exchange credentials for a JWT' },
      { method: 'GET', path: '/api/auth/me', description: 'Current user (Bearer token)' },
      { method: 'GET', path: '/api/users/profile', description: 'Read your profile' },
      { method: 'PUT', path: '/api/users/profile', description: 'Update your profile' },
    ],
  });
});

module.exports = { index };
