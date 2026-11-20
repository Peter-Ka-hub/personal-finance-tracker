// Unit tests for the auth service controllers (DB model is mocked).
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long!!';
delete process.env.CATEGORIES_SERVICE_URL; // skip the cross-service seed call

jest.mock('../src/models/User');
jest.mock('../src/models/PendingCategorySeed');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('node:http');
const { once } = require('node:events');
const User = require('../src/models/User');
const PendingCategorySeed = require('../src/models/PendingCategorySeed');
const { sequelize } = require('../src/config/db');
const app = require('../src/app');

const transaction = {};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(sequelize, 'transaction').mockImplementation((callback) => callback(transaction));
});

afterEach(() => jest.restoreAllMocks());

describe('auth-service', () => {
  test('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('auth');
  });

  test('register hashes the password and returns a JWT', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ id: 'user-1', username: 'alice' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('alice');
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.username).toBe('alice');
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice' }), { transaction });
    expect(PendingCategorySeed.create).toHaveBeenCalledWith({ userId: 'user-1' }, { transaction });

    // password stored must be a bcrypt hash, never the plaintext
    const stored = User.create.mock.calls[0][0].password;
    expect(stored).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', stored)).toBe(true);
  });

  test('register rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'bob' });
    expect(res.status).toBe(400);
  });

  test.each(['unavailable', 'slow'])(
    'register and login survive %s Categories, then login completes the pending seed',
    async (failure) => {
      let recovered = false;
      let seedRequests = 0;
      const categories = http.createServer((req, res) => {
        seedRequests += 1;
        req.resume();
        if (recovered) {
          res.writeHead(201).end();
        } else if (failure === 'slow') {
          // Even after response headers the request must have a deadline.
          res.writeHead(201, { 'Content-Length': '2' });
          res.flushHeaders();
        } else {
          res.writeHead(503).end();
        }
      });
      categories.listen(0, '127.0.0.1');
      await once(categories, 'listening');
      process.env.CATEGORIES_SERVICE_URL = `http://127.0.0.1:${categories.address().port}`;

      const credentials = { username: 'alice', password: 'secret123' };
      let stored;
      let pending;
      User.findOne.mockImplementation(async () => stored);
      User.create.mockImplementation(async (values) => {
        stored = { id: 'user-1', ...values };
        return stored;
      });
      PendingCategorySeed.create.mockImplementation(async (record) => {
        pending = record;
      });
      PendingCategorySeed.findByPk.mockImplementation(async () => pending);
      PendingCategorySeed.destroy.mockImplementation(async () => {
        pending = null;
      });

      try {
        const registration = await request(app).post('/api/auth/register')
          .timeout({ response: 3000 }).send(credentials);
        expect(registration.status).toBe(201);
        expect(jwt.verify(registration.body.token, process.env.JWT_SECRET).id).toBe('user-1');
        expect(pending).toEqual({ userId: 'user-1' });

        const loginDuringFailure = await request(app).post('/api/auth/login')
          .timeout({ response: 3000 }).send(credentials);
        expect(loginDuringFailure.status).toBe(200);
        expect(PendingCategorySeed.destroy).not.toHaveBeenCalled();

        recovered = true;
        const loginAfterRecovery = await request(app).post('/api/auth/login').send(credentials);
        expect(loginAfterRecovery.status).toBe(200);
        expect(pending).toBeNull();
        expect(seedRequests).toBe(3);

        const nextLogin = await request(app).post('/api/auth/login').send(credentials);
        expect(nextLogin.status).toBe(200);
        expect(seedRequests).toBe(3);
      } finally {
        delete process.env.CATEGORIES_SERVICE_URL;
        await new Promise((resolve) => {
          categories.close(resolve);
          categories.closeAllConnections();
        });
      }
    }
  );

  test('register rejects a too-short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'charlie', password: 'short' });
    expect(res.status).toBe(400);
    expect(User.create).not.toHaveBeenCalled();
  });

  test('register rejects an existing username', async () => {
    User.findOne.mockResolvedValue({ id: 'x', username: 'alice' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  test('login succeeds with the correct password', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    User.findOne.mockResolvedValue({ id: 'u1', username: 'alice', password: hash });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('login fails with a wrong password', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    User.findOne.mockResolvedValue({ id: 'u1', username: 'alice', password: hash });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong' });
    expect(res.status).toBe(400);
  });
});
