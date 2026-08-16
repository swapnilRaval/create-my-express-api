'use strict';

/**
 * Zod schemas for the auth endpoints.
 *
 * `.strict()` makes unknown keys an error rather than silently dropping them,
 * which is what stops a client from sneaking `role: "admin"` into a signup.
 */

const { z } = require('zod');

// Zod 4 moved format checks to top-level helpers: z.email() replaces the
// deprecated z.string().email().
//
// The order here is load-bearing. `z.email().trim()` validates BEFORE trimming,
// so a pasted address with a trailing space is rejected - a real problem with
// copy-pasted form input. Normalising first and piping into the format check
// is what makes " Ada@Example.COM " arrive as "ada@example.com".
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address').max(254));

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'Password must contain a lowercase letter, an uppercase letter and a digit',
  });

const name = z.string().trim().min(1, 'Required').max(60);

const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    password,
  })
  .strict();

const loginSchema = z
  .object({
    email,
    // Deliberately NOT the strong-password schema: rejecting a legacy password
    // at validation time would tell an attacker the policy without a login.
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

const forgotPasswordSchema = z.object({ email }).strict();

const resetPasswordSchema = z
  .object({
    token: z.string().min(32, 'Invalid reset token'),
    password,
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  passwordSchema: password,
  emailSchema: email,
};
