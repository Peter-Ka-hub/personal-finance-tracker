// Unit tests for the categories service controllers (DB model is mocked).
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long!!';
process.env.INTERNAL_API_KEY = 'internal-test-key';

jest.mock('../src/models/Category');
jest.mock('../src/models/CategorySeed');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const Category = require('../src/models/Category');
const CategorySeed = require('../src/models/CategorySeed');
const { sequelize } = require('../src/config/db');
const app = require('../src/app');

const token = jwt.sign({ id: 'user-1', username: 'alice' }, process.env.JWT_SECRET);
const auth = (r) => r.set('Authorization', `Bearer ${token}`);
const categoryId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => jest.clearAllMocks());

describe('category-service', () => {
  test('GET /api/categories without token → 401', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });

  test('GET /api/categories returns only the user own categories', async () => {
    Category.findAll.mockResolvedValue([{ id: 'c1', name: 'Jedzenie', type: 'expense' }]);
    const res = await auth(request(app).get('/api/categories'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Category.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', archivedAt: null } })
    );
  });

  test('can include archived categories for the owner', async () => {
    Category.findAll.mockResolvedValue([{ id: categoryId, archivedAt: '2026-11-20T13:00:00.000Z' }]);
    const res = await auth(request(app).get('/api/categories?includeArchived=true'));
    expect(res.status).toBe(200);
    expect(res.body[0].archivedAt).toBeTruthy();
    expect(Category.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
  });

  test('POST /api/categories creates a category', async () => {
    Category.create.mockResolvedValue({ id: 'c2', name: 'Wypłata', type: 'income' });
    const res = await auth(request(app).post('/api/categories')).send({ name: 'Wypłata', type: 'income' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Wypłata');
  });

  test('POST /api/categories validates required fields', async () => {
    const res = await auth(request(app).post('/api/categories')).send({ name: 'BrakTypu' });
    expect(res.status).toBe(400);
  });

  test('POST /api/categories rejects an invalid type', async () => {
    const res = await auth(request(app).post('/api/categories')).send({ name: 'X', type: 'bogus' });
    expect(res.status).toBe(400);
    expect(Category.create).not.toHaveBeenCalled();
  });

  test('DELETE /api/categories/:id archives an active owned category', async () => {
    Category.update.mockResolvedValue([1]);
    const res = await auth(request(app).delete(`/api/categories/${categoryId}`));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(categoryId);
    expect(Category.update).toHaveBeenCalledWith(
      { archivedAt: expect.any(Date) },
      { where: { id: categoryId, userId: 'user-1', archivedAt: null } }
    );
  });

  test('returns 404 when no matching active category can be archived', async () => {
    Category.update.mockResolvedValue([0]);
    const res = await auth(request(app).delete(`/api/categories/${categoryId}`));
    expect(res.status).toBe(404);
  });

  test('rejects an invalid delete id before querying the database', async () => {
    const res = await auth(request(app).delete('/api/categories/invalid'));
    expect(res.status).toBe(400);
    expect(Category.update).not.toHaveBeenCalled();
  });

  test('seed endpoint rejects a wrong internal key', async () => {
    const res = await request(app)
      .post('/api/categories/seed')
      .set('X-Internal-Key', 'wrong')
      .send({ userId: 'u', categories: [] });
    expect(res.status).toBe(403);
  });

  test('seed endpoint accepts the correct internal key', async () => {
    const transaction = {};
    const runTransaction = jest.spyOn(sequelize, 'transaction').mockImplementation(
      (callback) => callback(transaction)
    );
    CategorySeed.findOrCreate.mockResolvedValue([{}, true]);
    Category.bulkCreate.mockResolvedValue([]);
    try {
      const res = await request(app)
        .post('/api/categories/seed')
        .set('X-Internal-Key', process.env.INTERNAL_API_KEY)
        .send({ userId: 'u', categories: [{ name: 'X', type: 'expense' }] });
      expect(res.status).toBe(201);
      expect(CategorySeed.findOrCreate).toHaveBeenCalledWith({ where: { userId: 'u' }, transaction });
      expect(Category.bulkCreate).toHaveBeenCalledWith(
        [{ userId: 'u', name: 'X', type: 'expense' }],
        { transaction, validate: true }
      );
    } finally {
      runTransaction.mockRestore();
    }
  });
});
