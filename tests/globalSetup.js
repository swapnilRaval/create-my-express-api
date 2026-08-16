'use strict';

/**
 * Starts one in-memory MongoDB for the entire test run and publishes its URI
 * through process.env, which Jest copies into every worker.
 *
 * The first run downloads a mongod binary (~70 MB) into node_modules/.cache.
 * Set MONGOMS_DOWNLOAD_MIRROR or point MONGOMS_SYSTEM_BINARY at an installed
 * mongod if your network blocks that download.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'test' } });
  process.env.MONGO_URI = mongod.getUri();
  globalThis.__MONGOD__ = mongod;
};
