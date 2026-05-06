# 食品配料表评价应用 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Web 应用，用户上传食品配料表图片，MinerU v4 提取文字后由 DeepSeek 生成减肥视角评价，两栏展示结果。

**Architecture:** Node.js + Express 后端代理 MinerU 和 DeepSeek API，单文件 HTML 前端。后端从 `.env` 读取密钥，前端通过 `/api/parse` 和 `/api/evaluate` 与后端通信。

**Tech Stack:** Node.js 18+, Express, dotenv, multer, adm-zip, 前端纯 HTML/CSS/JS

---

## 文件结构

```
C:\Users\yangjh\Desktop\repos\2024news-3\
├── .env                          # 已存在：MinerU-api-key, DeepSeeker-api-key
├── package.json                  # 新建
├── server.js                     # 新建：Express 服务器 + API 路由
├── index.html                    # 新建：前端 UI
└── test/
    └── server.test.js            # 新建：服务器测试
```

---

### Task 1: 项目初始化

**Files:**
- Create: `package.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "food-label-evaluator",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "test": "node --test test/server.test.js"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
npm install express dotenv multer adm-zip
```

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: init project with dependencies
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 服务器骨架 + 静态文件服务

**Files:**
- Create: `server.js`
- Create: `test/server.test.js`

- [ ] **Step 1: 写测试 — 服务器启动并返回 200**

```javascript
// test/server.test.js
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/server.test.js
```

预期：全部失败（Cannot find module '../server'）

- [ ] **Step 3: 创建 server.js 骨架**

```javascript
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(__dirname));

const upload = require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/parse', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({ placeholder: true });
});

app.post('/api/evaluate', express.json(), (req, res) => {
  if (!req.body.text) return res.status(400).json({ error: 'No text provided' });
  res.json({ placeholder: true });
});

module.exports = { app };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
node --test test/server.test.js
```

预期：4 tests pass

- [ ] **Step 5: 提��**

```bash
git add server.js test/server.test.js
git commit -m "feat: add server skeleton with static file serving
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: MinerU 解析路由（/api/parse）

**Files:**
- Modify: `server.js`
- Modify: `test/server.test.js`

- [ ] **Step 1: 添加测试 — mock MinerU API 调用**

在 `test/server.test.js` 的 `describe('Server')` 块内追加：

```javascript
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/server.test.js
```

预期：新增的 MinerU 测试失败

- [ ] **Step 3: 实现 MinerU 解析函数**

将 `server.js` 中的 `/api/parse` 路由替换为：

```javascript
const AdmZip = require('adm-zip');

app.post('/api/parse', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const token = process.env['MinerU-api-key'];
    if (!token) return res.status(500).json({ error: 'MinerU API key not configured' });

    // Step 1: Get batch upload URLs
    const batchBody = JSON.stringify({
      files: [{ name: req.file.originalname, is_ocr: true }],
      model_version: 'pipeline',
      language: 'ch',
      enable_table: false,
      enable_formula: false
    });

    const batchRes = await fetch('https://mineru.net/api/v4/file-urls/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: batchBody
    });

    const batchData = await batchRes.json();
    if (batchData.code !== 0) {
      return res.status(502).json({ error: `MinerU error: ${batchData.msg}` });
    }

    const { batch_id, file_urls } = batchData.data;

    // Step 2: Upload file to signed URL
    await fetch(file_urls[0], {
      method: 'PUT',
      body: req.file.buffer
    });

    // Step 3: Poll for completion (max 60s)
    let fullZipUrl;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(
        `https://mineru.net/api/v4/extract-results/batch/${batch_id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const pollData = await pollRes.json();
      if (pollData.code !== 0) continue;
      const result = pollData.data?.extract_result?.[0];
      if (result?.state === 'done') {
        fullZipUrl = result.full_zip_url;
        break;
      }
      if (result?.state === 'failed') {
        return res.status(502).json({ error: `MinerU parsing failed: ${result.err_msg}` });
      }
    }

    if (!fullZipUrl) {
      return res.status(504).json({ error: 'MinerU parsing timeout (60s)' });
    }

    // Step 4: Download ZIP and extract markdown
    const zipRes = await fetch(fullZipUrl);
    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const mdEntry = zip.getEntries().find(e => e.entryName.endsWith('full.md'));
    if (!mdEntry) {
      return res.status(502).json({ error: 'No markdown found in MinerU result' });
    }

    const text = mdEntry.getData().toString('utf8');
    res.json({ text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
node --test test/server.test.js
```

预期：5 tests pass

- [ ] **Step 5: 提交**

```bash
git add server.js test/server.test.js
git commit -m "feat: add MinerU v4 file parsing route
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: DeepSeek 评价路由（/api/evaluate）

**Files:**
- Modify: `server.js`
- Modify: `test/server.test.js`

- [ ] **Step 1: 添加测试 — mock DeepSeek API**

在 `test/server.test.js` 的 `describe('Server')` 块内追加：

```javascript
  it('should evaluate text via DeepSeek and return JSON', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      if (url === 'https://api.deepseek.com/v1/chat/completions') {
        const body = JSON.parse(options.body);
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/server.test.js
```

预期：新增的 DeepSeek 测试失败

- [ ] **Step 3: 实现 DeepSeek 评价函数**

将 `server.js` 中的 `/api/evaluate` 路由替换为：

```javascript
app.post('/api/evaluate', express.json(), async (req, res) => {
  try {
    if (!req.body.text) return res.status(400).json({ error: 'No text provided' });

    const apiKey = process.env['DeepSeeker-api-key'];
    if (!apiKey) return res.status(500).json({ error: 'DeepSeek API key not configured' });

    const systemPrompt = `你是食品营养专家，专门为减肥人群分析食品配料表。根据用户提供的配料表文字，生成JSON格式的评价。

JSON字段说明：
- score: 0-100整数，综合评分，越高越适合减肥
- friendliness: "high"/"moderate"/"low"，减肥友好度
- friendlinessReason: 一句话说明评分依据
- warnings: 字符串数组，每个风险警示不超过30字。无风险则为空数组
- ingredients: 数组，每项含name(配料名)、role(功能类别，如"甜味剂")、note(减肥视角评价)

注意：
- 配料表按含量从高到低排列，排位越前含量越高
- 高度关注：添加糖、氢化油/起酥油/植脂末、高钠添加剂
- 只返回纯JSON，不要包含markdown代码块标记`;

    const res2 = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请分析以下食品配料表：\n\n${req.body.text}` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    const data = await res2.json();
    if (!data.choices?.[0]?.message?.content) {
      return res.status(502).json({ error: 'DeepSeek API returned unexpected response' });
    }

    const evaluation = JSON.parse(data.choices[0].message.content);
    res.json(evaluation);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
node --test test/server.test.js
```

预期：6 tests pass

- [ ] **Step 5: 提交**

```bash
git add server.js test/server.test.js
git commit -m "feat: add DeepSeek evaluation route
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: 前端 HTML + CSS

**Files:**
- Create: `index.html`

- [ ] **Step 1: 创建 index.html（结构和样式）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>食品配料表评价</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f5f5f5; color: #333; line-height: 1.6;
    min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 20px; }
  h1 { text-align: center; font-size: 1.5rem; margin-bottom: 20px; color: #2d6a4f; }

  .upload-area {
    border: 2px dashed #ccc; border-radius: 12px; padding: 40px 20px;
    text-align: center; cursor: pointer; transition: border-color .2s;
    background: #fff; margin-bottom: 24px;
  }
  .upload-area:hover, .upload-area.dragover { border-color: #2d6a4f; }
  .upload-area.has-image { padding: 12px; }
  .upload-area img { max-width: 100%; max-height: 200px; border-radius: 8px; }
  .upload-hint { color: #999; font-size: .9rem; margin-top: 8px; }
  .upload-input { display: none; }

  .status {
    text-align: center; padding: 40px 20px; display: none;
  }
  .status.visible { display: block; }
  .spinner {
    width: 40px; height: 40px; border: 4px solid #e0e0e0;
    border-top-color: #2d6a4f; border-radius: 50%; animation: spin .8s linear infinite;
    margin: 0 auto 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status-text { color: #666; font-size: .95rem; }

  .error {
    background: #fff0f0; border: 1px solid #ffcccc; border-radius: 8px;
    padding: 12px 16px; color: #c00; margin-bottom: 20px; display: none;
  }
  .error.visible { display: block; }

  .result { display: none; }
  .result.visible { display: block; }

  .result-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  }
  @media (max-width: 640px) {
    .result-grid { grid-template-columns: 1fr; }
  }

  .card {
    background: #fff; border-radius: 12px; padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08);
  }

  .score-card { text-align: center; }
  .score-ring {
    width: 120px; height: 120px; border-radius: 50%;
    margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;
    font-size: 2rem; font-weight: 700;
  }
  .score-high { background: #d4edda; color: #155724; }
  .score-moderate { background: #fff3cd; color: #856404; }
  .score-low { background: #f8d7da; color: #721c24; }

  .friendliness-badge {
    display: inline-block; padding: 4px 12px; border-radius: 20px;
    font-size: .85rem; font-weight: 600;
  }
  .badge-high { background: #d4edda; color: #155724; }
  .badge-moderate { background: #fff3cd; color: #856404; }
  .badge-low { background: #f8d7da; color: #721c24; }

  .warnings-list { list-style: none; }
  .warnings-list li {
    padding: 8px 0; border-bottom: 1px solid #f0f0f0;
    display: flex; align-items: flex-start; gap: 8px;
  }
  .warnings-list li:last-child { border-bottom: none; }
  .warn-icon { color: #e67e22; flex-shrink: 0; }

  .ingredient-item {
    padding: 10px 0; border-bottom: 1px solid #f0f0f0;
  }
  .ingredient-item:last-child { border-bottom: none; }
  .ingredient-name { font-weight: 600; }
  .ingredient-role { font-size: .8rem; color: #888; margin-left: 6px; }
  .ingredient-note { font-size: .9rem; color: #555; margin-top: 4px; }

  .card-title {
    font-size: 1rem; font-weight: 600; margin-bottom: 12px;
    padding-bottom: 8px; border-bottom: 2px solid #2d6a4f;
  }
</style>
</head>
<body>
<div class="container">
  <h1>食品配料表评价</h1>

  <div class="error" id="error"></div>

  <div class="upload-area" id="uploadArea">
    <img id="preview" style="display:none" alt="">
    <div id="uploadHint">
      <div style="font-size:2rem;margin-bottom:8px;">📷</div>
      <div>点击或拖拽上传配料表图片</div>
      <div class="upload-hint">支持 JPG、PNG、WebP，不超过 10MB</div>
    </div>
  </div>
  <input type="file" accept="image/*" class="upload-input" id="fileInput">

  <div class="status" id="statusParsing">
    <div class="spinner"></div>
    <div class="status-text">正在识别配料表文字...</div>
  </div>
  <div class="status" id="statusEvaluating">
    <div class="spinner"></div>
    <div class="status-text">正在生成评价...</div>
  </div>

  <div class="result" id="result">
    <div class="result-grid">
      <div class="card score-card">
        <div class="card-title">综合评分</div>
        <div class="score-ring" id="scoreRing">--</div>
        <div class="friendliness-badge" id="friendlinessBadge">--</div>
        <div style="margin-top:8px;font-size:.9rem;color:#666" id="friendlinessReason"></div>
      </div>
      <div class="card">
        <div class="card-title">⚠️ 风险警示</div>
        <ul class="warnings-list" id="warningsList"></ul>
        <div id="noWarnings" style="color:#888;text-align:center;padding:20px;display:none">未发现明显风险</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-title">🔬 成分科普</div>
      <div id="ingredientsList"></div>
    </div>
  </div>
</div>

<script>
// JS 在 Task 6 实现
</script>
</body>
</html>
```

- [ ] **Step 2: 验证服务器能正确提供静态文件**

```bash
node --test test/server.test.js
```

预期：6 tests pass（Step 1 的测试仍然通过，静态文件服务返回 index.html）

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "feat: add frontend HTML structure and styles
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: 前端 JavaScript 逻辑

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 替换 <script> 标签内容**

将 `index.html` 中的空 `<script>` 标签替换为：

```javascript
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const uploadHint = document.getElementById('uploadHint');
const errorDiv = document.getElementById('error');
const statusParsing = document.getElementById('statusParsing');
const statusEvaluating = document.getElementById('statusEvaluating');
const resultDiv = document.getElementById('result');

uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

async function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showError('文件大小不能超过 10MB');
    return;
  }

  hideError();
  hideResult();

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    uploadHint.style.display = 'none';
    uploadArea.classList.add('has-image');
  };
  reader.readAsDataURL(file);

  try {
    // Parse
    showStatus('parsing');
    const parseForm = new FormData();
    parseForm.append('image', file);
    const parseRes = await fetch('/api/parse', { method: 'POST', body: parseForm });
    if (!parseRes.ok) {
      const err = await parseRes.json();
      throw new Error(err.error || '解析失败');
    }
    const { text } = await parseRes.json();

    // Evaluate
    hideStatus('parsing');
    showStatus('evaluating');
    const evalRes = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!evalRes.ok) {
      const err = await evalRes.json();
      throw new Error(err.error || '评价失败');
    }
    const data = await evalRes.json();

    hideStatus('evaluating');
    renderResult(data);
  } catch (err) {
    hideStatus('parsing');
    hideStatus('evaluating');
    showError(err.message);
  }
}

function showStatus(type) {
  if (type === 'parsing') statusParsing.classList.add('visible');
  if (type === 'evaluating') statusEvaluating.classList.add('visible');
}
function hideStatus(type) {
  if (type === 'parsing') statusParsing.classList.remove('visible');
  if (type === 'evaluating') statusEvaluating.classList.remove('visible');
}

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.add('visible');
}
function hideError() {
  errorDiv.classList.remove('visible');
}
function hideResult() {
  resultDiv.classList.remove('visible');
}

function renderResult(data) {
  resultDiv.classList.add('visible');

  // Score ring
  const ring = document.getElementById('scoreRing');
  ring.textContent = data.score + '分';
  ring.className = 'score-ring';
  if (data.score >= 70) ring.classList.add('score-high');
  else if (data.score >= 40) ring.classList.add('score-moderate');
  else ring.classList.add('score-low');

  // Friendliness
  const badge = document.getElementById('friendlinessBadge');
  badge.className = 'friendliness-badge';
  if (data.friendliness === 'high') {
    badge.textContent = '🟢 减肥友好';
    badge.classList.add('badge-high');
  } else if (data.friendliness === 'moderate') {
    badge.textContent = '🟡 适量食用';
    badge.classList.add('badge-moderate');
  } else {
    badge.textContent = '🔴 建议避免';
    badge.classList.add('badge-low');
  }
  document.getElementById('friendlinessReason').textContent = data.friendlinessReason || '';

  // Warnings
  const warningsList = document.getElementById('warningsList');
  const noWarnings = document.getElementById('noWarnings');
  warningsList.innerHTML = '';
  if (data.warnings && data.warnings.length > 0) {
    noWarnings.style.display = 'none';
    data.warnings.forEach(w => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="warn-icon">⚠️</span><span>${escapeHtml(w)}</span>`;
      warningsList.appendChild(li);
    });
  } else {
    noWarnings.style.display = 'block';
  }

  // Ingredients
  const ingredientsList = document.getElementById('ingredientsList');
  ingredientsList.innerHTML = '';
  (data.ingredients || []).forEach(ing => {
    const div = document.createElement('div');
    div.className = 'ingredient-item';
    div.innerHTML = `
      <div><span class="ingredient-name">${escapeHtml(ing.name)}</span><span class="ingredient-role">${escapeHtml(ing.role)}</span></div>
      <div class="ingredient-note">${escapeHtml(ing.note)}</div>
    `;
    ingredientsList.appendChild(div);
  });

  // Scroll to result
  resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 2: 验证前端和后端协同工作**

手动测试（非自动化）：启动服务器 `node server.js`，打开 `http://localhost:3000`，确认：
- 页面加载正常
- 上传区可点击和拖拽
- 预览显示正常

- [ ] **Step 3: 运行已有测试确保无回归**

```bash
node --test test/server.test.js
```

预期：6 tests pass

- [ ] **Step 4: 提交**

```bash
git add index.html
git commit -m "feat: add frontend JavaScript logic
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: 端到端集成验证

**Files:**
- 无需修改代码

- [ ] **Step 1: 运行全部测试**

```bash
node --test test/server.test.js
```

预期：6 tests pass

- [ ] **Step 2: 启动服务器并手动验证**

```bash
node server.js
```

打开浏览器访问 `http://localhost:3000`，完成以下验收：
- 上传一张配料表图片 → 看到解析状态 → 看到评价结果
- 两栏布局正常（桌面端）→ 调整浏览器宽度到 640px 以下确认移动端堆叠
- 上传非图片文件 → 应该不会有反应（accept="image/*" 过滤）
- 上传超过 10MB 文件 → 前端提示错误

- [ ] **Step 3: 提交最终状态**

```bash
git add -A
git commit -m "feat: complete food label evaluator application
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
