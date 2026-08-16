'use strict';

/**
 * Authentication use-cases.
 *
 * Controllers stay thin: they translate HTTP to arguments and results to
 * responses. Everything that is actually a business rule lives here, which is
 * what makes these functions callable from a CLI script, a queue worker or a
 * test without dragging Express along.
 */

const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const { signAccessToken } = require('../helpers/jwt.helper');
const { hashPassword } = require('../helpers/password.helper');
const emailService = require('./email.service');
const logger = require('../utils/logger');

async function register({ firstName, lastName, email, password }) {
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', [
      { field: 'email', message: 'Already registered' },
    ]);
  }

  // `role` is intentionally NOT accepted from the caller. Promoting a user to
  // admin is an administrative action, not something a signup form can do.
  const user = await User.create({ firstName, lastName, email, password });

  // Email failure must not fail the registration - the account already exists.
  emailService
    .sendWelcomeEmail(user)
    .catch((err) => logger.warn(`Welcome email to ${user.email} failed: ${err.message}`));

  return { user, token: signAccessToken(user) };
}

async function login({ email, password }) {
  // `password` is select:false on the schema, so it must be asked for.
  const user = await User.findOne({ email }).select('+password');

  // One message for both "no such user" and "wrong password": distinguishing
  // them turns the login endpoint into an account-enumeration oracle.
  const invalid = ApiError.unauthorized('Invalid email or password');
  if (!user) {
    // Constant-ish work so a missing account is not detectably faster.
    await hashPassword(password).catch(() => {});
    throw invalid;
  }

  const matches = await user.comparePassword(password);
  if (!matches) throw invalid;
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  user.password = undefined;
  return { user, token: signAccessToken(user) };
}

async function getAuthenticatedUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/**
 * Always resolves, whether or not the address exists. Reporting "no such user"
 * would leak which emails are registered.
 */
async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user || !user.isActive) return { sent: false };

  const rawToken = user.createPasswordResetToken(30);
  await user.save({ validateBeforeSave: false });

  try {
    await emailService.sendResetPasswordEmail(user, rawToken);
  } catch (err) {
    // Roll the token back so a failed send does not leave a dangling credential.
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save({ validateBeforeSave: false });
    throw ApiError.internal(`Could not send the reset email: ${err.message}`);
  }

  return { sent: true, token: rawToken };
}

async function resetPassword({ token, password }) {
  const hashed = User.hashResetToken(token);

  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');

  // Assigning the plain value is correct: the pre-save hook hashes it.
  user.password = password;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  return { user, token: signAccessToken(user) };
}

module.exports = {
  register,
  login,
  getAuthenticatedUser,
  requestPasswordReset,
  resetPassword,
};
