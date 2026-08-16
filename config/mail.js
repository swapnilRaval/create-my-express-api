'use strict';

/**
 * SMTP transport.
 *
 * Created lazily and cached, so importing this module never opens a socket -
 * that matters for tests and for `node -e "require('./app')"` style checks.
 *
 * When MAIL_HOST is not configured the transport falls back to Nodemailer's
 * jsonTransport, which "sends" by returning the serialised message. That keeps
 * development and CI working with no SMTP server and no silent failures.
 */

const nodemailer = require('nodemailer');
const env = require('./env');
const logger = require('../utils/logger');

let transporter = null;

function isConfigured() {
  return Boolean(env.MAIL_HOST);
}

function getTransport() {
  if (transporter) return transporter;

  if (!isConfigured()) {
    logger.warn('MAIL_HOST is not set - emails will be logged instead of sent (jsonTransport).');
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT || 587,
    // true for port 465 (implicit TLS), false for 587 (STARTTLS upgrade).
    secure: env.MAIL_SECURE,
    auth: env.MAIL_USER ? { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } : undefined,
    pool: true,
    maxConnections: 3,
  });

  return transporter;
}

/** Optional startup check - call from www if you want to fail fast on bad SMTP. */
async function verifyTransport() {
  if (!isConfigured()) return false;
  await getTransport().verify();
  logger.info(`SMTP ready at ${env.MAIL_HOST}:${env.MAIL_PORT || 587}`);
  return true;
}

async function closeTransport() {
  if (transporter && typeof transporter.close === 'function') transporter.close();
  transporter = null;
}

module.exports = { getTransport, verifyTransport, closeTransport, isConfigured };
