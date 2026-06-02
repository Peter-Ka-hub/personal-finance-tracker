// Unit tests for the transactions service controllers (DB model is mocked).
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long!!';

jest.mock('../src/models/Transaction');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const Transaction = require('../src/models/Transaction');
const app = require('../src/app');

const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
const auth = (r) => r.set('Authorization', `Bearer ${token}`);

beforeEach(() => jest.clearAllMocks());

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
    const res = await auth(request(app).post('/api/transactions')).send({
      type: 'expense', amount: 50, categoryId: 'cat-1', description: 'Lunch', date: '2026-06-02',
    });
    expect(res.status).toBe(201);
    expect(Transaction.create).toHaveBeenCalled();
  });

  test('validates missing transaction fields', async () => {
    const res = await auth(request(app).post('/api/transactions')).send({ type: 'expense' });
    expect(res.status).toBe(400);
  });

  test('deletes an owned transaction', async () => {
    const destroy = jest.fn().mockResolvedValue();
    Transaction.findOne.mockResolvedValue({ id: 't1', destroy });
    const res = await auth(request(app).delete('/api/transactions/t1'));
    expect(res.status).toBe(200);
  });

  test('returns 404 when deleting a non-existent transaction', async () => {
    Transaction.findOne.mockResolvedValue(null);
    const res = await auth(request(app).delete('/api/transactions/none'));
    expect(res.status).toBe(404);
  });
});
