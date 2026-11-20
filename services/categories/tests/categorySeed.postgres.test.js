const { randomUUID } = require('node:crypto');
const request = require('supertest');

jest.mock('../src/config/db', () => {
  const { Sequelize } = require('sequelize');
  const { randomUUID } = require('node:crypto');
  const schema = `seed_test_${randomUUID().replaceAll('-', '')}`;
  return {
    sequelize: new Sequelize(process.env.CATEGORY_TEST_DATABASE_URL, { schema, logging: false }),
  };
});

const describeWithPostgres = process.env.CATEGORY_TEST_DATABASE_URL ? describe : describe.skip;

describeWithPostgres('category seed on PostgreSQL', () => {
  let app;
  let sequelize;
  let Category;
  let CategorySeed;
  const internalKey = 'postgres-test-internal-key';
  const defaults = Array.from({ length: 10 }, (_, i) => ({ name: `Default ${i}`, type: 'expense' }));

  const seed = (userId, categories = defaults, target = app) => request(target)
    .post('/api/categories/seed')
    .set('X-Internal-Key', internalKey)
    .send({ userId, categories });

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = internalKey;
    ({ sequelize } = require('../src/config/db'));
    app = require('../src/app');
    Category = require('../src/models/Category');
    CategorySeed = require('../src/models/CategorySeed');
    await sequelize.createSchema(sequelize.options.schema);
    await sequelize.sync();
  });

  afterAll(async () => {
    if (sequelize) {
      try {
        await sequelize.dropSchema(sequelize.options.schema);
      } finally {
        await sequelize.close();
      }
    }
  });

  test('concurrent requests commit one set and retries preserve deletions and custom categories', async () => {
    const userId = randomUUID();
    const where = { userId };
    const results = await Promise.all(Array.from({ length: 5 }, () => seed(userId)));
    expect(results.map((result) => result.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await Category.count({ where })).toBe(10);
    expect(await CategorySeed.count({ where })).toBe(1);

    await Category.destroy({ where });
    const custom = await Category.create({ userId, name: 'Własna kategoria', type: 'income' });
    expect((await seed(userId)).status).toBe(200);
    expect((await Category.findAll({ where })).map(({ id }) => id)).toEqual([custom.id]);
  });

  test('retries safely if the connection closes after commit and before the response', async () => {
    const userId = randomUUID();
    const closeBeforeResponse = (req, res) => {
      // The controller sends the response only after the database commit.
      res.end = () => res.destroy();
      app(req, res);
    };

    await expect(seed(userId, defaults, closeBeforeResponse)).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
    expect((await seed(userId)).status).toBe(200);
    expect(await Category.count({ where: { userId } })).toBe(10);
  });

  test('rolls back the marker and all categories if a category cannot be saved', async () => {
    const userId = randomUUID();
    const where = { userId };
    expect((await seed(userId, [...defaults, { type: 'expense' }])).status).toBe(500);
    expect(await CategorySeed.count({ where })).toBe(0);
    expect(await Category.count({ where })).toBe(0);

    expect((await seed(userId)).status).toBe(201);
    expect(await Category.count({ where })).toBe(10);
  });
});
