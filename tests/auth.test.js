'use strict';

const request = require('supertest');
const app = require('../app');
const User = require('../models/user.model');
const { connect, clearDatabase, disconnect, registerUser, VALID_USER } = require('./helpers');

describe('Authentication', () => {
  beforeAll(connect);
  afterEach(clearDatabase);
  afterAll(disconnect);

  describe('POST /api/auth/register', () => {
    it('creates an account and returns a token, never the password', async () => {
      const response = await request(app).post('/api/auth/register').send(VALID_USER);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toEqual(expect.any(String));
      expect(response.body.data.user.email).toBe(VALID_USER.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('stores a bcrypt hash rather than the plain password', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);

      const stored = await User.findOne({ email: VALID_USER.email }).select('+password');
      expect(stored.password).not.toBe(VALID_USER.password);
      expect(stored.password).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('rejects a weak password with 422 and field-level errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, password: 'short' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.errors.some((e) => e.field === 'body.password')).toBe(true);
    });

    it('refuses to let a client set its own role', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, role: 'admin' });

      // .strict() makes the unknown key an error rather than silently dropping it.
      expect(response.status).toBe(422);
    });

    it('returns 409 on a duplicate email', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
      const response = await request(app).post('/api/auth/register').send(VALID_USER);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
    });

    it('returns a token for correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toEqual(expect.any(String));
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: 'Wrong12345' });

      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: VALID_USER.password });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid Bearer token', async () => {
      const { token } = await registerUser(request, app);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(VALID_USER.email);
    });

    it('rejects a request with no token', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('rejects a malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Token abc.def.ghi');
      expect(response.status).toBe(401);
    });

    it('rejects a tampered token', async () => {
      const { token } = await registerUser(request, app);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token.slice(0, -2)}xx`);

      expect(response.status).toBe(401);
    });
  });

  describe('Protected user routes', () => {
    it('reads and updates the profile with a token', async () => {
      const { token } = await registerUser(request, app);

      const read = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(read.status).toBe(200);

      const update = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Augusta' });

      expect(update.status).toBe(200);
      expect(update.body.data.user.firstName).toBe('Augusta');
    });

    it('does not re-hash the password when an unrelated field changes', async () => {
      const { token } = await registerUser(request, app);
      const before = await User.findOne({ email: VALID_USER.email }).select('+password');

      await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ lastName: 'Byron' });

      const after = await User.findOne({ email: VALID_USER.email }).select('+password');
      expect(after.password).toBe(before.password);

      // And the original password must still work.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password });
      expect(login.status).toBe(200);
    });

    it('blocks the admin listing for a normal user with 403', async () => {
      const { token } = await registerUser(request, app);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });
});
