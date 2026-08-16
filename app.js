'use strict';

/**
 * Express application factory.
 *
 * This file only *builds* the app: middleware, routes, error handling.
 * It never opens a database connection and never binds a port - that is the
 * job of ./www. Keeping the two apart is what lets the test suite import this
 * module and drive it with Supertest without a live server or a real Mongo.
 */

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const notFoundHandler = require('./middlewares/not-found.middleware');
const errorHandler = require('./middlewares/error.middleware');
const { apiLimiter } = require('./middlewares/rate-limit.middleware');

const app = express();

// Behind a reverse proxy (nginx, Heroku, Render, Fly) the client IP arrives in
// X-Forwarded-For. Without this, express-rate-limit would bucket every request
// under the proxy's IP and rate-limit your whole userbase as one client.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Security headers. The CSP is relaxed just enough to serve the sample EJS page
// from a local stylesheet; tighten or drop it if this API is JSON-only.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }),
);

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);

// Payload caps. Without an explicit limit a single request can pin your event
// loop parsing a 100 MB JSON body.
app.use(express.json({ limit: env.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.BODY_LIMIT }));

// HTTP access logs go through Winston so there is exactly one log pipeline.
app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.http(message.trim()) },
    skip: () => env.NODE_ENV === 'test',
  }),
);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// Uploaded files are served with a cross-origin resource policy so a browser
// frontend on a different port can display them. Anything genuinely private
// should be served through an authenticated route instead of this static mount.
app.use(
  '/uploads',
  express.static(env.UPLOAD_DIR, {
    maxAge: '1d',
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

// Rate limiting applies to the API surface only, so static assets and the
// health probe are never throttled.
app.use('/api', apiLimiter);

app.use(routes);

// Order matters: 404 first, then the single error handler, both last.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
