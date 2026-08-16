'use strict';

/**
 * Application logger (Winston) with an HTTP level that Morgan writes into.
 *
 * Anything that looks like a credential is redacted before it is formatted, so
 * an accidental `logger.info(req.body)` during a login cannot write a password
 * to disk. Redaction is cheap insurance; treat it as a safety net, not a
 * licence to log request bodies.
 */

const path = require('node:path');
const fs = require('node:fs');
const winston = require('winston');
const env = require('../config/env');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordconfirm',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'jwt_secret',
  'jwtsecret',
  'secret',
  'mail_password',
  'apikey',
  'api_key',
]);

function redact(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
  }
  return out;
}

// Winston attaches Symbol keys to `info`; a format must mutate and return the
// same object rather than build a new one, or those symbols are lost and the
// printf/json formatters stop seeing the level and message.
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) info[key] = '[REDACTED]';
    else if (info[key] && typeof info[key] === 'object') info[key] = redact(info[key]);
  }
  return info;
});

const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

winston.addColors({ error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'blue' });

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) =>
    `${timestamp} ${level}: ${stack || message}`),
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.json(),
);

const transports = [
  new winston.transports.Console({
    format: env.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
    silent: env.LOG_LEVEL === 'silent',
  }),
];

// File transports only in production: in development the console is enough,
// and writing logs/ during tests just leaves junk behind.
if (env.NODE_ENV === 'production') {
  const logDir = env.LOG_DIR;
  fs.mkdirSync(logDir, { recursive: true });
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
}

const logger = winston.createLogger({
  levels,
  level: env.LOG_LEVEL === 'silent' ? 'error' : env.LOG_LEVEL,
  format: winston.format.combine(winston.format.errors({ stack: true }), redactFormat()),
  transports,
  exitOnError: false,
});

module.exports = logger;
