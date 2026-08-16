'use strict';

/**
 * Shared test plumbing. Every test file connects to the in-memory database in
 * beforeAll, wipes collections between tests so cases cannot leak into each
 * other, and disconnects in afterAll.
 */

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../config/db');

const VALID_USER = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Password123',
};

async function connect() {
  if (mongoose.connection.readyState === 0) await connectDatabase();
}

async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function disconnect() {
  await disconnectDatabase();
}

/** Registers a user through the API and returns { user, token }. */
async function registerUser(request, app, overrides = {}) {
  const payload = { ...VALID_USER, ...overrides };
  const response = await request(app).post('/api/auth/register').send(payload);
  return { response, ...(response.body.data || {}), payload };
}

module.exports = { connect, clearDatabase, disconnect, registerUser, VALID_USER };
