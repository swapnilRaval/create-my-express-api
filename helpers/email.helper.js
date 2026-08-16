'use strict';

/**
 * Renders an EJS template from views/emails and sends it.
 *
 * Templates are rendered with ejs.renderFile rather than res.render because
 * email is sent from services and background jobs where there is no response
 * object in scope.
 */

const path = require('node:path');
const ejs = require('ejs');
const env = require('../config/env');
const logger = require('../utils/logger');
const { getTransport, isConfigured } = require('../config/mail');

const TEMPLATE_DIR = path.join(__dirname, '..', 'views', 'emails');

/** Crude but dependency-free HTML -> text fallback for clients that refuse HTML. */
function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} template  file name without extension, e.g. 'welcome'
 * @param {object} data      variables exposed to the template
 */
async function renderTemplate(template, data = {}) {
  const file = path.join(TEMPLATE_DIR, `${template}.ejs`);
  return ejs.renderFile(file, { appName: 'smoke-test', appUrl: env.APP_URL, ...data }, { async: true });
}

/**
 * @param {{to: string, subject: string, template: string, data?: object}} options
 */
async function sendEmail({ to, subject, template, data = {}, attachments }) {
  if (!to) throw new TypeError('sendEmail requires a "to" address');

  const html = await renderTemplate(template, data);

  const info = await getTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    text: htmlToText(html),
    attachments,
  });

  if (!isConfigured()) {
    logger.info(`[email:dry-run] "${subject}" -> ${to}`);
  } else {
    logger.info(`Email "${subject}" sent to ${to} (${info.messageId})`);
  }

  return info;
}

module.exports = { sendEmail, renderTemplate, htmlToText };
