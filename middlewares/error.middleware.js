'use strict';

/**
 * The single place this API turns a thrown value into an HTTP response.
 *
 * Everything upstream throws; nothing upstream formats an error body. That is
 * what keeps `{ success:false, message, errors }` consistent across the whole
 * surface, and what makes it possible to change the error contract in one edit.
 *
 * Development responses include the stack; production responses reduce any
 * non-operational error to a generic 500 so internal detail never reaches a
 * client.
 */

const mongoose = require('mongoose');
const multer = require('multer');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');

/** Maps known third-party error shapes onto ApiError. */
function normalise(err) {
  if (err instanceof ApiError) return err;

  // Mongoose: bad ObjectId in a route param or filter.
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${err.path}"`, [
      { field: err.path, message: `Expected a valid ${err.kind}` },
    ]);
  }

  // Mongoose: schema validation.
  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.unprocessable(
      'Validation failed',
      Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    );
  }

  // MongoDB duplicate key. Reported as 409, and the offending field is echoed
  // back, but never the offending value (it could be another user's email).
  if (err && (err.code === 11000 || err.code === 11001)) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`, [
      { field, message: 'Must be unique' },
    ]);
  }

  // jsonwebtoken errors that escaped the helper (e.g. thrown by a library).
  if (err && err.name === 'TokenExpiredError') return ApiError.unauthorized('Token has expired');
  if (err && err.name === 'JsonWebTokenError') return ApiError.unauthorized('Invalid token');

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'File is too large',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: `Unexpected field "${err.field}"`,
      LIMIT_PART_COUNT: 'Too many parts in the multipart request',
    };
    return ApiError.badRequest(messages[err.code] || 'File upload failed', [
      { field: err.field || 'file', message: err.code },
    ]);
  }

  // express.json() rejecting a malformed or oversized body.
  if (err && err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body is not valid JSON');
  }
  if (err && err.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large');
  }

  // Anything unrecognised is a bug, not a client error.
  return new ApiError(err?.statusCode || err?.status || 500, err?.message || 'Internal server error', {
    isOperational: false,
    cause: err,
  });
}

function wantsHtml(req) {
  return !req.originalUrl.startsWith('/api') && req.accepts(['json', 'html']) === 'html';
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity (4).
module.exports = function errorHandler(err, req, res, next) {
  const error = normalise(err);
  const isProduction = env.NODE_ENV === 'production';
  const exposeDetail = error.isOperational || !isProduction;

  if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.statusCode}`, {
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${error.statusCode}: ${error.message}`);
  }

  // If the response already started streaming we cannot change the status.
  if (res.headersSent) return next(err);

  const body = {
    success: false,
    message: exposeDetail ? error.message : 'Internal server error',
    errors: error.errors || [],
  };

  if (!isProduction) {
    body.stack = error.stack;
  }

  if (wantsHtml(req)) {
    return res.status(error.statusCode).render('errors/error', {
      title: `Error ${error.statusCode}`,
      statusCode: error.statusCode,
      message: body.message,
      stack: isProduction ? null : error.stack,
    });
  }

  return res.status(error.statusCode).json(body);
};
