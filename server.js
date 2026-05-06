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
