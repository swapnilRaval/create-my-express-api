'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, paginated } = require('../helpers/response.helper');
const userService = require('../services/user.service');
const ApiError = require('../utils/apiError');
const { toPublicPath } = require('../middlewares/upload.middleware');

const getProfile = asyncHandler(async (req, res) =>
  ok(res, 'Profile retrieved', { user: req.user }));

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return ok(res, 'Profile updated', { user });
});

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user.id, req.body);
  return ok(res, 'Password changed successfully');
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file received. Send one file in the "image" field.');

  const publicPath = toPublicPath(req.file.path);
  const user = await userService.setProfileImage(req.user.id, publicPath);

  return ok(res, 'Profile image updated', { user, url: publicPath });
});

/** Admin-only listing; the route applies authorize('admin'). */
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.validated.query;
  const result = await userService.list({ page, limit, search });
  return paginated(res, 'Users retrieved', result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.validated.params.id);
  return ok(res, 'User retrieved', { user });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  uploadProfileImage,
  listUsers,
  getUserById,
};
