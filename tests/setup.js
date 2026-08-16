'use strict';

/**
 * Runs in every worker before the test file is evaluated.
 *
 * Only environment defaults belong here. MONGO_URI is injected by
 * tests/globalSetup.js, which starts a single in-memory MongoDB for the whole
 * run and exports its URI through process.env.
 */

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = process.env.JWT_SECRET
  || 'test-only-secret-that-is-definitely-long-enough-0123456789';
process.env.JWT_EXPIRES_IN = '1h';
process.env.APP_URL = 'http://localhost:3000';
process.env.UPLOAD_DIR = 'uploads/.test';
// Empty MAIL_HOST puts Nodemailer into jsonTransport, so tests never send mail.
process.env.MAIL_HOST = '';
