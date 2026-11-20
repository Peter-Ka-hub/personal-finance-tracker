// End-to-end test exercising the full stack through the Nginx gateway.
// Requires the docker-compose stack to be running (see docker-compose.yml).
// Run with:  node --test e2e/app.test.mjs
// Override base URL:  E2E_BASE_URL=http://localhost node --test e2e/app.test.mjs
//
// Flow: register -> default categories auto-seeded -> create & list a
// transaction -> login. Uses the public gateway only (no direct service ports).

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const username = `e2e_${Date.now()}`;
const password = 'e2e-password-123';

let token;
let categoryId;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait until the gateway AND every upstream service is actually serving — not
// just the gateway's own /health (which nginx answers without touching any
// upstream). An upstream that is still starting returns 502/503/504, so we wait
// until each probe returns a real application status (< 500).
async function waitForReady(timeoutMs = 240000) {
  const probes = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/api/categories' }, // 401 when categories is up
    { method: 'GET', path: '/api/transactions' }, // 401 when transactions is up
    { method: 'POST', path: '/api/auth/login', body: { username: '_probe_', password: '_probe_' } }, // 400 when auth is up
  ];
  const deadline = Date.now() + timeoutMs;
  for (const probe of probes) {
    let last;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BASE}${probe.path}`, {
          method: probe.method,
          headers: probe.body ? { 'Content-Type': 'application/json' } : undefined,
          body: probe.body ? JSON.stringify(probe.body) : undefined,
        });
        last = res.status;
        if (res.status < 500) {
          ready = true;
          break;
        }
      } catch (e) {
        last = e.message;
      }
      await sleep(2000);
    }
    if (!ready) {
      throw new Error(`Service not ready for ${probe.method} ${probe.path} (last: ${last})`);
    }
  }
}

before(async () => {
  await waitForReady();
});

test('the public gateway blocks category initialization', async () => {
  for (const path of ['/api/categories/seed', '/api/categories/seed/', '/api/categories/SEED']) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 404, path);
  }
});

test('register creates a user and returns a JWT', async () => {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.token, 'expected a token');
  assert.equal(body.username, username);
  token = body.token;
});

test('default categories are seeded for the new user', async () => {
  const res = await fetch(`${BASE}/api/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  const categories = await res.json();
  assert.equal(categories.length, 10, 'expected one set of default categories');
  categoryId = categories.find((category) => category.type === 'expense')?.id;
  assert.ok(categoryId, 'expected a default expense category');
});

test('the public gateway still allows creating a category', async () => {
  const res = await fetch(`${BASE}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'E2E category', type: 'expense' }),
  });
  assert.equal(res.status, 201);
  const category = await res.json();
  assert.equal(category.name, 'E2E category');
});

test('create and list a transaction (data is persisted)', async () => {
  const create = await fetch(`${BASE}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'expense',
      amount: 42.5,
      categoryId,
      description: 'E2E lunch',
      date: '2026-06-02',
    }),
  });
  assert.equal(create.status, 201);

  const list = await fetch(`${BASE}/api/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(list.status, 200);
  const transactions = await list.json();
  assert.ok(
    transactions.some((t) => t.description === 'E2E lunch'),
    'expected the created transaction to be returned'
  );
});

test('login with the same credentials returns a JWT', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.token, 'expected a token');
});

test('protected route rejects requests without a token', async () => {
  const res = await fetch(`${BASE}/api/transactions`);
  assert.equal(res.status, 401);
});

const request = (path, jwt, { body, method = body ? 'POST' : 'GET' } = {}) => fetch(`${BASE}${path}`, {
  method,
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(8000),
});

const addExpense = (categoryId, jwt = token, type = 'expense') => request('/api/transactions', jwt, {
  body: { type, categoryId, amount: 42.5, date: '2028-02-29', description: 'E2E category check' },
});

test('archives categories, retains labels, and rejects categories unavailable to a second account', async () => {
  const other = await request('/api/auth/register', token, { body: { username: `${username}_2`, password } });
  assert.equal(other.status, 201);
  const otherToken = (await other.json()).token;
  const categoryResponse = await request('/api/categories', token, {
    body: { name: 'E2E archiwum', type: 'expense', color: '#123456' },
  });
  assert.equal(categoryResponse.status, 201);
  const category = await categoryResponse.json();

  const foreign = await addExpense(category.id, otherToken);
  const missing = await addExpense(randomUUID(), otherToken);
  assert.equal(foreign.status, 400);
  assert.equal(missing.status, 400);
  const unavailable = await missing.json();
  assert.deepEqual(await foreign.json(), unavailable);
  const wrongType = await addExpense(category.id, token, 'income');
  assert.equal(wrongType.status, 400);
  assert.deepEqual(await wrongType.json(), unavailable);

  const created = await addExpense(category.id);
  assert.equal(created.status, 201);
  const transaction = await created.json();
  assert.equal((await request(`/api/categories/${category.id}`, otherToken, { method: 'DELETE' })).status, 404);
  assert.equal((await request(`/api/categories/${category.id}`, token, { method: 'DELETE' })).status, 200);

  const archived = await addExpense(category.id);
  assert.equal(archived.status, 400);
  assert.deepEqual(await archived.json(), unavailable);
  const active = await (await request('/api/categories', token)).json();
  assert.ok(!active.some(({ id }) => id === category.id));
  const history = await (await request('/api/categories?includeArchived=true', token)).json();
  const label = history.find(({ id }) => id === category.id);
  assert.equal(label.name, category.name);
  assert.equal(label.color, '#123456');
  assert.ok(label.archivedAt);
  const otherHistory = await (await request('/api/categories?includeArchived=true', otherToken)).json();
  assert.ok(!otherHistory.some(({ id }) => id === category.id));
  const transactions = await (await request('/api/transactions', token)).json();
  assert.ok(transactions.some(({ id, categoryId }) => id === transaction.id && categoryId === category.id));
});

test('PostgreSQL serializes archiving with inserts and keeps legacy orphaned transactions', {
  skip: !process.env.E2E_POSTGRES_URL,
}, async () => {
  const require = createRequire(new URL('../services/transactions/package.json', import.meta.url));
  const { Client } = require('pg');
  const db = new Client({ connectionString: process.env.E2E_POSTGRES_URL });
  const observer = new Client({ connectionString: process.env.E2E_POSTGRES_URL });
  const pending = [];

  async function waitForLock(queryPrefix) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const { rows: [{ waiting }] } = await observer.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE $1
        ) AS waiting
      `, [`${queryPrefix}%`]);
      if (waiting) return;
      await sleep(25);
    }
    assert.fail(`Expected a request waiting for the database lock on ${queryPrefix}`);
  }

  try {
    await db.connect();
    await observer.connect();
    const createCategory = async (name) => {
      const res = await request('/api/categories', token, { body: { name, type: 'expense' } });
      assert.equal(res.status, 201);
      return res.json();
    };
    const first = await createCategory('E2E zapis wygrywa');
    const second = await createCategory('E2E archiwizacja wygrywa');

    // Pause the POST after it locks the category, before it inserts the transaction.
    await db.query('BEGIN');
    await db.query('LOCK TABLE transactions."Transactions" IN ACCESS EXCLUSIVE MODE');
    const postFirst = addExpense(first.id);
    pending.push(postFirst);
    await waitForLock('INSERT INTO "transactions"."Transactions"');
    const archiveAfterPost = request(`/api/categories/${first.id}`, token, { method: 'DELETE' });
    pending.push(archiveAfterPost);
    await waitForLock('UPDATE "categories"."Categories"');
    await db.query('COMMIT');
    const inserted = await postFirst;
    assert.equal(inserted.status, 201);
    assert.equal((await archiveAfterPost).status, 200);

    // Hold the same UPDATE that the archive endpoint performs before it commits.
    await db.query('BEGIN');
    await db.query('UPDATE categories."Categories" SET "archivedAt" = now() WHERE id = $1', [second.id]);
    const postAfterArchive = addExpense(second.id);
    pending.push(postAfterArchive);
    await waitForLock('SELECT id FROM categories."Categories"');
    await db.query('COMMIT');
    assert.equal((await postAfterArchive).status, 400);

    const { rows: [owner] } = await db.query('SELECT id FROM auth."Users" WHERE username = $1', [username]);
    const orphanId = randomUUID();
    const missingCategory = randomUUID();
    await db.query(`
      INSERT INTO transactions."Transactions"
        (id, "userId", "categoryId", type, amount, description, date, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'expense', 1, 'Legacy orphan', '2026-01-01', now(), now())
    `, [orphanId, owner.id, missingCategory]);
    const transactions = await (await request('/api/transactions', token)).json();
    assert.ok(transactions.some(({ id, categoryId }) => id === orphanId && categoryId === missingCategory));
    const committed = await inserted.json();
    assert.ok(transactions.some(({ id }) => id === committed.id));
  } finally {
    await db.end();
    await observer.end();
    await Promise.allSettled(pending);
  }
});
