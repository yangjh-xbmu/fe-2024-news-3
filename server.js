require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(__dirname));

const upload = require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
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

app.post('/api/evaluate', express.json(), (req, res) => {
  if (!req.body.text) return res.status(400).json({ error: 'No text provided' });
  res.json({ placeholder: true });
});

module.exports = { app };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}
