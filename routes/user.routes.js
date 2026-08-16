'use strict';

const express = require('express');
const userController = require('../controllers/user.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { profileImageUpload } = require('../middlewares/upload.middleware');
const {
  updateProfileSchema,
  changePasswordSchema,
  listUsersSchema,
  objectIdSchema,
} = require('../validators/user.validator');

const router = express.Router();

// Everything below requires a valid token.
router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', validate({ body: updateProfileSchema }), userController.updateProfile);
router.patch('/profile/password', validate({ body: changePasswordSchema }), userController.changePassword);

// `profileImageUpload.single('image')` must run before the controller so that
// req.file exists; Multer errors are normalised by the error middleware.
router.post('/profile-image', profileImageUpload.single('image'), userController.uploadProfileImage);

router.get('/', authorize('admin'), validate({ query: listUsersSchema }), userController.listUsers);
router.get('/:id', authorize('admin'), validate({ params: objectIdSchema }), userController.getUserById);

module.exports = router;
