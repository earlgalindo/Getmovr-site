const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test.sqlite');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

process.env.DB_PATH = TEST_DB;
process.env.ADMIN_API_KEY = 'test-key';

const app = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const suffix of ['', '-shm', '-wal']) {
    const f = TEST_DB + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

test('POST /api/quotes rejects invalid input', async () => {
  const res = await fetch(`${baseUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', phone: '', email: 'not-an-email', service: 'bogus' })
  });
  assert.equal(res.status, 400);
});

test('POST /api/quotes creates a lead, and admin can list/update it', async () => {
  const createRes = await fetch(`${baseUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jane Doe',
      phone: '416-555-0100',
      email: 'jane@example.com',
      service: 'moving',
      date: '2026-09-01',
      details: 'Two-bedroom apartment move'
    })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.status, 'new');
  assert.ok(created.id);

  // Without an API key, admin endpoints are locked
  const unauthedRes = await fetch(`${baseUrl}/api/quotes`);
  assert.equal(unauthedRes.status, 401);

  const listRes = await fetch(`${baseUrl}/api/quotes`, { headers: { 'x-api-key': 'test-key' } });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.total >= 1);

  const patchRes = await fetch(`${baseUrl}/api/quotes/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify({ status: 'contacted' })
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  assert.equal(updated.status, 'contacted');
});
