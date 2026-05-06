const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

let server;
const PORT = 3099;

before(async () => {
  process.env.PORT = PORT;
  const { app } = require('../server');
  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });
});

after(() => {
  if (server) server.close();
});

describe('Server', () => {
  it('should serve index.html with 200', async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    assert.strictEqual(res.status, 200);
  });

  it('should return 404 for unknown routes', async () => {
    const res = await fetch(`http://localhost:${PORT}/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  it('should return 400 when /api/parse called without file', async () => {
    const form = new FormData();
    const res = await fetch(`http://localhost:${PORT}/api/parse`, {
      method: 'POST', body: form
    });
    assert.strictEqual(res.status, 400);
  });

  it('should return 400 when /api/evaluate called without text', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });
});
