'use strict';

/**
 * Named, typed email operations. Everything that sends mail goes through here
 * so subject lines and template names are defined once.
 */

const env = require('../config/env');
const { sendEmail } = require('../helpers/email.helper');

async function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to smoke-test',
    template: 'welcome',
    data: {
      firstName: user.firstName,
      loginUrl: `${env.APP_URL}/api/auth/login`,
    },
  });
}

/**
 * @param {object} user
 * @param {string} rawToken  the unhashed token - only ever leaves the app here
 */
async function sendResetPasswordEmail(user, rawToken) {
  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  return sendEmail({
    to: user.email,
    subject: 'Reset your smoke-test password',
    template: 'reset-password',
    data: {
      firstName: user.firstName,
      resetUrl,
      expiresInMinutes: 30,
    },
  });
}

module.exports = { sendWelcomeEmail, sendResetPasswordEmail, sendEmail };
