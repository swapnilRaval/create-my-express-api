'use strict';

/**
 * Jest configuration.
 *
 * `testEnvironment: node` because there is no DOM. `--runInBand` (set in the
 * npm script) keeps the in-memory MongoDB to a single instance rather than one
 * per worker, which is both faster and far less flaky.
 */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'middlewares/**/*.js',
    'helpers/**/*.js',
    'utils/**/*.js',
    'validators/**/*.js',
  ],
  coverageDirectory: 'coverage',
  // The first run downloads a mongod binary; give it room.
  testTimeout: 60_000,
  verbose: true,
  // Surfaces handles that would otherwise make Jest hang at the end of a run.
  detectOpenHandles: false,
  forceExit: false,
};
