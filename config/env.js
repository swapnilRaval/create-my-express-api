'use strict';

/**
 * Configuration loader.
 *
 * Every environment variable is read here, exactly once, and validated with
 * Zod. Nothing else in the codebase touches process.env. A missing or
 * malformed variable fails immediately at boot with a readable message rather
 * than surfacing as a confusing runtime error three hours later.
 */

const path = require('node:path');

// The project root, derived from this file's location rather than from
// process.cwd(). Without this, `node ./my-project/www` from a parent directory
// would silently fail to find .env, and uploads/logs would land in the wrong
// place - a bug that only shows up once someone runs the app from elsewhere
// (PM2, systemd, a Dockerfile with a different WORKDIR).
const ROOT_DIR = path.join(__dirname, '..');

require('dotenv').config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),

  MONGO_URI: z
    .string()
    .min(1, 'MONGO_URI is required')
    .refine((v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), {
      message: 'MONGO_URI must start with mongodb:// or mongodb+srv://',
    }),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('*'),
  BODY_LIMIT: z.string().default('1mb'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug', 'silent']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  APP_URL: z.string().default('http://localhost:3000'),

  // Relative values are resolved against the project root below.
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(5),

  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  MAIL_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('No Reply <no-reply@example.com>'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill it in.`);
}

const config = { ...result.data, ROOT_DIR };

// Make UPLOAD_DIR absolute so every consumer agrees on where files live.
config.UPLOAD_DIR = path.isAbsolute(config.UPLOAD_DIR)
  ? config.UPLOAD_DIR
  : path.join(ROOT_DIR, config.UPLOAD_DIR);

config.LOG_DIR = path.join(ROOT_DIR, 'logs');

// Frozen so a stray assignment somewhere cannot silently change config at runtime.
module.exports = Object.freeze(config);
