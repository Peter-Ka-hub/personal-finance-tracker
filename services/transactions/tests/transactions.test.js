// Unit tests for the transactions service controllers (DB model is mocked).
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long!!';

jest.mock('../src/models/Transaction');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const Transaction = require('../src/models/Transaction');
const { sequelize } = require('../src/config/db');
const app = require('../src/app');

const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
const auth = (r) => r.set('Authorization', `Bearer ${token}`);
const categoryId = '11111111-1111-4111-8111-111111111111';
const transactionId = '22222222-2222-4222-8222-222222222222';
const validTransaction = { type: 'expense', amount: 50, categoryId, description: 'Lunch', date: '2028-02-29' };
const dbTransaction = {};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(sequelize, 'transaction').mockImplementation((_options, callback) => callback(dbTransaction));
  jest.spyOn(sequelize, 'query').mockResolvedValue([{ id: categoryId }]);
});

afterEach(() => jest.restoreAllMocks());

describe('transaction-service', () => {
  test('GET /api/transactions without token → 401', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  test('lists the user transactions', async () => {
    Transaction.findAll.mockResolvedValue([{ id: 't1', amount: '10.00' }]);
    const res = await auth(request(app).get('/api/transactions'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Transaction.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
  });

  test('creates a transaction', async () => {
    Transaction.create.mockResolvedValue({ id: 't2', amount: '50.00' });
    const res = await auth(request(app).post('/api/transactions')).send(validTransaction);
    expect(res.status).toBe(201);
    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'), expect.objectContaining({
      bind: { categoryId, userId: 'user-1', type: 'expense' },
      transaction: dbTransaction,
    }));
    expect(Transaction.create).toHaveBeenCalledWith(
      { ...validTransaction, userId: 'user-1' }, { transaction: dbTransaction }
    );
  });

  test('validates missing transaction fields', async () => {
    const res = await auth(request(app).post('/api/transactions')).send({ type: 'expense' });
    expect(res.status).toBe(400);
  });

  test.each([
    ['type', 'bogus'],
    ['amount', -5],
    ['amount', true],
    ['amount', 0],
    ['amount', 100000000],
    ['amount', 1.001],
    ['amount', '1.001'],
    ['categoryId', 'c1'],
    ['date', '2026-02-29'],
    ['date', '2026-11-31'],
    ['date', '0000-01-01'],
    ['date', '2026-1-01'],
  ])('rejects invalid %s %s before checking the category', async (field, value) => {
    const res = await auth(request(app).post('/api/transactions'))
      .send({ ...validTransaction, [field]: value });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: field })]));
    expect(sequelize.query).not.toHaveBeenCalled();
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test.each([0.01, 99999999.99, '42.50'])('accepts decimal amount %s', async (amount) => {
    const res = await auth(request(app).post('/api/transactions')).send({ ...validTransaction, amount });
    expect(res.status).toBe(201);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: Number(amount) }), { transaction: dbTransaction }
    );
  });

  test('rejects an unavailable category', async () => {
    sequelize.query.mockResolvedValue([]);
    const res = await auth(request(app).post('/api/transactions')).send(validTransaction);
    expect(res.status).toBe(400);
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('deletes an owned transaction', async () => {
    const destroy = jest.fn().mockResolvedValue();
    Transaction.findOne.mockResolvedValue({ id: 't1', destroy });
    const res = await auth(request(app).delete(`/api/transactions/${transactionId}`));
    expect(res.status).toBe(200);
  });

  test('returns 404 when deleting a non-existent transaction', async () => {
    Transaction.findOne.mockResolvedValue(null);
    const res = await auth(request(app).delete(`/api/transactions/${transactionId}`));
    expect(res.status).toBe(404);
  });

  test('rejects an invalid delete id before querying the database', async () => {
    const res = await auth(request(app).delete('/api/transactions/invalid'));
    expect(res.status).toBe(400);
    expect(Transaction.findOne).not.toHaveBeenCalled();
  });
});
