require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(__dirname));

const upload = require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are accepted'));
  }
});

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

    if (!batchRes.ok) {
      const body = await batchRes.text().catch(() => '');
      return res.status(502).json({ error: `MinerU HTTP ${batchRes.status}: ${body}` });
    }
    const batchData = await batchRes.json();
    if (batchData.code !== 0) {
      return res.status(502).json({ error: `MinerU error: ${batchData.msg}` });
    }

    const { batch_id, file_urls } = batchData.data;

    // Step 2: Upload file to signed URL
    await fetch(file_urls[0], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
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
      if (!pollRes.ok) continue;
      let pollData;
      try { pollData = await pollRes.json(); } catch { continue; }
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

    if (!res2.ok) {
      const body = await res2.text().catch(() => '');
      return res.status(502).json({ error: `DeepSeek HTTP ${res2.status}: ${body}` });
    }
    const data = await res2.json();
    if (!data.choices?.[0]?.message?.content) {
      return res.status(502).json({ error: 'DeepSeek API returned unexpected response' });
    }

    let evaluation;
    try {
      evaluation = JSON.parse(data.choices[0].message.content);
    } catch {
      return res.status(502).json({ error: 'Invalid JSON in DeepSeek response' });
    }
    res.json(evaluation);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}
