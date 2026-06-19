require('dotenv').config();

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');

const upload = multer({ dest: path.join(__dirname, 'tmp') });

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

// ── Client CRUD ──────────────────────────────────────────────────────────────
app.post('/api/clients', (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

    const trimmedName = name.trim();
    const id = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (cfg.clients.find(c => c.id === id)) {
      return res.status(409).json({ error: 'A client with this name already exists' });
    }

    fs.mkdirSync(path.join(__dirname, 'Assets', trimmedName), { recursive: true });

    const newClient = {
      id,
      name: trimmedName,
      category: (category || '').trim(),
      tileSize: 'featured',
      grid: { columns: 3, gap: 20, width: 80, maxWidth: 0, paddingTop: 40, paddingBottom: 0, rowHeight: 0 },
      assets: [],
    };
    cfg.clients.push(newClient);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');

    res.json({ ok: true, id, client: newClient });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── File upload ───────────────────────────────────────────────────────────────
app.post('/api/upload/:clientId', upload.array('files'), (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const client = cfg.clients.find(c => c.id === req.params.clientId);
    if (!client) {
      (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} });
      return res.status(404).json({ error: 'Client not found' });
    }

    const folderPath = client.assets[0]
      ? client.assets[0].file.substring(0, client.assets[0].file.lastIndexOf('/'))
      : 'Assets/' + client.name;

    const dir = path.join(__dirname, folderPath);
    fs.mkdirSync(dir, { recursive: true });

    const uploaded = [];
    for (const file of (req.files || [])) {
      const dest = path.join(dir, file.originalname);
      fs.renameSync(file.path, dest);
      uploaded.push(folderPath + '/' + file.originalname);
    }

    res.json({ ok: true, files: uploaded });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
