// Real integration smoke test: boots the actual server (node server.js) against a
// live MongoDB and exercises health + the auth flow (register → login → me).
// Run with `npm test` in server/. Requires a reachable MongoDB (CI provides one via
// a service container; locally set MONGODB_URI + JWT_SECRET first).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
let proc;

async function waitForHealth(timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* server not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not become healthy in time');
}

before(async () => {
  proc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
  await waitForHealth();
});

after(() => { if (proc) proc.kill('SIGTERM'); });

test('GET /api/health returns ok', async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.status, 'ok');
});

test('register → login → me round-trips with a real JWT', async () => {
  const email = `ci+${Date.now()}@example.com`;
  const password = 'CiTest1234';

  let r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'CI User', email, password, role: 'mentee' }),
  });
  assert.equal(r.status, 201, 'register should 201');
  let body = await r.json();
  assert.ok(body.token, 'register returns a JWT');

  r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200, 'login should 200');
  body = await r.json();
  assert.ok(body.token, 'login returns a JWT');

  r = await fetch(`${BASE}/api/auth/me`, {
    headers: { authorization: `Bearer ${body.token}` },
  });
  assert.equal(r.status, 200, 'authenticated /me should 200');
});

test('rejects a weak password (validation is wired)', async () => {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Bad', email: `ci+weak${Date.now()}@example.com`, password: 'short', role: 'mentee' }),
  });
  assert.equal(r.status, 400, 'weak password should be rejected');
});
