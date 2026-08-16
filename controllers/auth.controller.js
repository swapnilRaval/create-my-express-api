'use strict';

/**
 * HTTP layer for /api/auth. Each handler does three things and no more:
 * read validated input, call a service, send a response.
 */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../helpers/response.helper');
const authService = require('../services/auth.service');
const env = require('../config/env');

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  return created(res, 'Account created successfully', { user, token });
});

const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  return ok(res, 'Logged in successfully', { user, token });
});

const me = asyncHandler(async (req, res) => {
  // authenticate middleware already loaded and validated the user.
  return ok(res, 'Current user retrieved', { user: req.user });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);

  // The same response either way, so this endpoint cannot be used to discover
  // which addresses have accounts.
  const payload = env.NODE_ENV === 'production' ? null : { devToken: result.token ?? null };

  return ok(res, 'If that email is registered, a reset link has been sent', payload);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { user, token } = await authService.resetPassword(req.body);
  return ok(res, 'Password reset successfully', { user, token });
});

module.exports = { register, login, me, forgotPassword, resetPassword };
