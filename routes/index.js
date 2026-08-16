'use strict';

/**
 * Route table. Every path the API answers is visible from this one file.
 */

const express = require('express');
const mongoose = require('mongoose');
const { ok } = require('../helpers/response.helper');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const homeController = require('../controllers/home.controller');

const router = express.Router();

/**
 * Liveness + readiness in one probe. Deliberately outside /api so it is never
 * rate limited, and deliberately shallow: it reports the Mongo connection state
 * without issuing a query, so a slow database cannot make the probe time out
 * and get the container killed.
 */
router.get('/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return ok(res, 'API is healthy', {
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: states[mongoose.connection.readyState] || 'unknown',
  });
});

router.get('/', homeController.index);

router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);

module.exports = router;
