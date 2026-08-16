'use strict';

/**
 * Password hashing.
 *
 * bcryptjs (pure JS) rather than bcrypt (native addon): the native package
 * needs a C++ toolchain, which is the single most common reason `npm install`
 * fails on a fresh Windows machine. bcryptjs is a few times slower to hash,
 * which at 12 rounds is a difference of milliseconds on a request that already
 * hits the database.
 *
 * The salt is generated per password by bcrypt itself and stored inside the
 * resulting hash string - there is no separate salt column by design.
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new TypeError('hashPassword expects a non-empty string');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string') return false;
  return bcrypt.compare(plain, hash);
}

/** True when the string is already a bcrypt digest - guards double hashing. */
function isHashed(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

module.exports = { hashPassword, comparePassword, isHashed, SALT_ROUNDS };
