'use strict';

const { z } = require('zod');
const { passwordSchema, emailSchema } = require('./auth.validator');

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    email: emailSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

const listUsersSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().max(120).optional().default(''),
  })
  .strict();

const objectIdSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a 24-character MongoDB ObjectId'),
  })
  .strict();

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  listUsersSchema,
  objectIdSchema,
};
