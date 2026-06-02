// End-to-end test exercising the full stack through the Nginx gateway.
// Requires the docker-compose stack to be running (see docker-compose.yml).
// Run with:  node --test e2e/app.test.mjs
//
// Flow: register -> default categories auto-seeded -> create & list a
// transaction -> login. Uses the public gateway only (no direct service ports).

import test, { before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const username = `e2e_${Date.now()}`;
const password = 'e2e-password-123';

let token;
let categoryId;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch (e) {
      lastErr = e;
    }
    await sleep(2000);
  }
  throw new Error(`Gateway /health not ready in time: ${lastErr ?? 'unknown'}`);
}

before(async () => {
  await waitForHealth();
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
  // Seeding is an async auth -> categories call; allow a short retry window.
  let categories = [];
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${BASE}/api/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    categories = await res.json();
    if (categories.length > 0) break;
    await sleep(1000);
  }
  assert.ok(categories.length > 0, 'expected default categories to be seeded');
  categoryId = categories[0].id;
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
