'use strict';

/**
 * MongoDB connection layer.
 *
 * The connection string comes from the environment only - nothing here is
 * hard-coded, and no credential is ever written to a log line.
 */

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

// Reject queries against fields that are not in the schema instead of silently
// ignoring them - catches typos in filters, which are otherwise invisible bugs.
mongoose.set('strictQuery', true);

/** Strips credentials so a URI can appear in logs. */
function redactUri(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@]+)@/, '//$1:****@');
}

async function connectDatabase(uri = env.MONGO_URI) {
  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  await mongoose.connect(uri, {
    // Fail fast at boot instead of buffering commands for 30s behind a dead server.
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  logger.info(`MongoDB connected: ${redactUri(uri)}`);
  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close(false);
  logger.info('MongoDB connection closed');
}

module.exports = { connectDatabase, disconnectDatabase, redactUri, mongoose };
