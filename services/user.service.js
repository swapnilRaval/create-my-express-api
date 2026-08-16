'use strict';

const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const { removeUploadedFile } = require('../middlewares/upload.middleware');

async function getById(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/**
 * Updates profile fields only.
 *
 * The allow-list is the important part: passing `req.body` straight into an
 * update would let a client set `role`, `isActive` or `password`. Password
 * changes go through changePassword so the pre-save hook runs - note that
 * findByIdAndUpdate would BYPASS that hook and store a plain-text password.
 */
const UPDATABLE_FIELDS = ['firstName', 'lastName', 'email'];

async function updateProfile(userId, payload) {
  const user = await getById(userId);

  for (const field of UPDATABLE_FIELDS) {
    if (payload[field] !== undefined) user[field] = payload[field];
  }

  await user.save();
  return user;
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    throw ApiError.badRequest('Current password is incorrect', [
      { field: 'currentPassword', message: 'Does not match our records' },
    ]);
  }

  user.password = newPassword;
  await user.save();
  return user;
}

async function setProfileImage(userId, publicPath) {
  const user = await getById(userId);
  const previous = user.profileImage;

  user.profileImage = publicPath;
  await user.save({ validateBeforeSave: false });

  // Only clean up after the write succeeded, so a failure cannot destroy the
  // old avatar without a replacement in place.
  if (previous && previous !== publicPath) await removeUploadedFile(previous);

  return user;
}

/** Paginated listing, used by the admin-only route. */
async function list({ page = 1, limit = 20, search = '' } = {}) {
  const filter = search
    ? {
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    }
    : {};

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

module.exports = {
  getById,
  updateProfile,
  changePassword,
  setProfileImage,
  list,
};
