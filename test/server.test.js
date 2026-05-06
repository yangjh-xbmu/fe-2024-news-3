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

  it('should parse image via MinerU and return text', async () => {
    const originalFetch = global.fetch;

    // Mock MinerU batch URL request
    let callCount = 0;
    global.fetch = async (url, options) => {
      if (url === 'https://mineru.net/api/v4/file-urls/batch') {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            batch_id: 'test-batch-id',
            file_urls: ['https://mineru-upload.example.com/upload']
          },
          msg: 'ok'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url === 'https://mineru-upload.example.com/upload') {
        return new Response(null, { status: 200 });
      }
      if (url.includes('/api/v4/extract-results/batch/')) {
        callCount++;
        const state = callCount <= 2 ? 'running' : 'done';
        return new Response(JSON.stringify({
          code: 0,
          data: {
            batch_id: 'test-batch-id',
            extract_result: [{
              file_name: 'test.jpg',
              state,
              ...(state === 'done' ? { full_zip_url: 'https://cdn.example.com/result.zip' } : {})
            }]
          },
          msg: 'ok'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url === 'https://cdn.example.com/result.zip') {
        // Return a minimal ZIP containing full.md
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();
        zip.addFile('test/full.md', Buffer.from('# 配料表\n小麦粉、白砂糖', 'utf8'));
        return new Response(zip.toBuffer(), { status: 200 });
      }
      return originalFetch(url, options);
    };

    try {
      const form = new FormData();
      const testImage = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // minimal JPEG header
      form.append('image', new Blob([testImage], { type: 'image/jpeg' }), 'test.jpg');

      const res = await fetch(`http://localhost:${PORT}/api/parse`, {
        method: 'POST', body: form
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.text.includes('配料表'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should evaluate text via DeepSeek and return JSON', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      if (url === 'https://api.deepseek.com/v1/chat/completions') {
        const body = JSON.parse(options.body);
        assert.strictEqual(body.model, 'deepseek-chat');
        assert.ok(body.messages[0].content.includes('减肥'));
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                score: 65,
                friendliness: 'moderate',
                friendlinessReason: '含添加糖但整体可控',
                warnings: ['白砂糖含量较高'],
                ingredients: [
                  { name: '小麦粉', role: '主食成分', note: '提供碳水化合物' }
                ]
              })
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, options);
    };

    try {
      const res = await fetch(`http://localhost:${PORT}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '小麦粉、白砂糖' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.score, 65);
      assert.strictEqual(data.friendliness, 'moderate');
      assert.ok(Array.isArray(data.warnings));
      assert.ok(Array.isArray(data.ingredients));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
