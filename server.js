require('dotenv').config();

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── Static files (portfolio) ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('config.json')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

// ── Admin panel ─────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── Config API ───────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'js', 'config.json');

app.get('/api/config', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'Could not read config.json' });
  }
});

app.put('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not save config.json' });
  }
});

// ── Asset discovery ──────────────────────────────────────────────────────────
const MEDIA_RE = /\.(png|jpe?g|gif|webp|mp4|webm|mov)$/i;
const ASSETS_DIR = path.join(__dirname, 'Assets');

app.get('/api/assets', (req, res) => {
  try {
    const result = {};
    if (!fs.existsSync(ASSETS_DIR)) return res.json(result);

    fs.readdirSync(ASSETS_DIR).forEach(dir => {
      const full = path.join(ASSETS_DIR, dir);
      if (!fs.statSync(full).isDirectory()) return;
      result[dir] = fs.readdirSync(full)
        .filter(f => MEDIA_RE.test(f) && f !== 'logo.png')
        .map(f => 'Assets/' + dir + '/' + f);
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Could not scan Assets folder' });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  Portfolio : http://localhost:' + PORT);
  console.log('  Admin     : http://localhost:' + PORT + '/admin');
  console.log('');
});
