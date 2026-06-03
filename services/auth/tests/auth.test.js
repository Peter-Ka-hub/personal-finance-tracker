// Unit tests for the auth service controllers (DB model is mocked).
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long!!';
delete process.env.CATEGORIES_SERVICE_URL; // skip the cross-service seed call

jest.mock('../src/models/User');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const app = require('../src/app');

beforeEach(() => jest.clearAllMocks());

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

    // password stored must be a bcrypt hash, never the plaintext
    const stored = User.create.mock.calls[0][0].password;
    expect(stored).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', stored)).toBe(true);
  });

  test('register rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'bob' });
    expect(res.status).toBe(400);
  });

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
