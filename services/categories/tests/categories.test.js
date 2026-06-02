// Unit tests for the categories service controllers (DB model is mocked).
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long!!';
process.env.INTERNAL_API_KEY = 'internal-test-key';

jest.mock('../src/models/Category');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const Category = require('../src/models/Category');
const app = require('../src/app');

const token = jwt.sign({ id: 'user-1', username: 'alice' }, process.env.JWT_SECRET);
const auth = (r) => r.set('Authorization', `Bearer ${token}`);

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
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
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

  test('DELETE /api/categories/:id removes an owned category', async () => {
    const destroy = jest.fn().mockResolvedValue();
    Category.findOne.mockResolvedValue({ id: 'c1', destroy });
    const res = await auth(request(app).delete('/api/categories/c1'));
    expect(res.status).toBe(200);
    expect(destroy).toHaveBeenCalled();
  });

  test('seed endpoint rejects a wrong internal key', async () => {
    const res = await request(app)
      .post('/api/categories/seed')
      .set('X-Internal-Key', 'wrong')
      .send({ userId: 'u', categories: [] });
    expect(res.status).toBe(403);
  });

  test('seed endpoint accepts the correct internal key', async () => {
    Category.bulkCreate.mockResolvedValue([]);
    const res = await request(app)
      .post('/api/categories/seed')
      .set('X-Internal-Key', process.env.INTERNAL_API_KEY)
      .send({ userId: 'u', categories: [{ name: 'X', type: 'expense' }] });
    expect(res.status).toBe(201);
    expect(Category.bulkCreate).toHaveBeenCalled();
  });
});
