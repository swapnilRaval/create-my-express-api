'use strict';

const request = require('supertest');
const app = require('../app');
const { connect, disconnect } = require('./helpers');

describe('GET /health', () => {
  beforeAll(connect);
  afterAll(disconnect);

  it('reports a healthy API and a connected database', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'API is healthy',
    });
    expect(response.body.data.database).toBe('connected');
    expect(typeof response.body.data.uptime).toBe('number');
  });

  it('returns a consistent 404 envelope for unknown routes', async () => {
    const response = await request(app).get('/definitely-not-a-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Cannot GET');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  it('sets security headers from helmet', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
