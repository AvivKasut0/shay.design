# Shay Design Portfolio — Project Notes

## How to run
```
npm start           # starts server at http://localhost:3000
```
- Portfolio: http://localhost:3000
- Admin:     http://localhost:3000/admin

## Stack
- **Frontend**: Pure HTML/CSS/JS — no build tools, no frameworks
- **Backend**: Node.js + Express (`server.js`)
- **Config**: `js/config.json` — single source of truth, read/written by API
- **Assets**: `Assets/<ProjectName>/` — excluded from git (on Dropbox)
- **File upload**: multer (tmp/ → Assets/)

## File map
```
index.html      portfolio SPA (hash routing: #client/<id>)
admin.html      admin panel SPA
server.js       Express backend + all API routes
css/style.css   portfolio styles + dark mode
css/admin.css   admin styles + dark mode
js/main.js      portfolio renderer (router, lightbox, theme toggle)
js/admin.js     admin panel (grid editor, CRUD, drag-reorder, upload)
js/config.json  all content: designer info + projects + assets
```

## Key architecture

### Config shape
```json
{
  "designer": { "name": "...", "tagline": "...", "logo": "Assets/logo.png", "email": "...", "social": {} },
  "clients": [{
    "id": "animal-care",
    "name": "Animal Care",
    "category": "Social Media",
    "logo": "Assets/Animal Care/logo.png",
    "tileSize": "featured",
    "grid": {
      "columns": 2, "gap": 26, "width": 63, "maxWidth": 0,
      "paddingTop": 36, "paddingBottom": 0, "rowHeight": 450,
      "tablet": { "columns": 2, "rowHeight": 230 },
      "mobile": { "columns": 1, "rowHeight": 240 }
    },
    "assets": [{ "file": "Assets/Animal Care/img.png", "type": "image", "cols": 2, "rows": 3 }]
  }]
}
```

### Grid per-breakpoint
- Base grid settings live on `client.grid` directly
- Breakpoint overrides: `client.grid.tablet = {...}`, `client.grid.mobile = {...}`
- `resolveGrid(rawGrid)` in main.js merges base + override for current viewport
- `resolvedG(client)` in admin.js does the same using `activeBP` state
- `align-items: stretch` + `grid-auto-rows: Npx` when `rowHeight > 0`
- Asset `cols`/`rows` are clamped to `g.columns` on render

### Dark mode
- Inline `<head>` script reads `localStorage.theme` or `prefers-color-scheme` → sets `data-theme` on `<html>`
- CSS: `[data-theme="dark"] { --bg: ...; }` + component overrides in both style.css and admin.css
- Toggle button appended to nav (live) and admin bar (admin) by JS

### Admin viewport toolbar
- Desktop / Tablet · 768px / Mobile · 390px icon buttons above preview
- Changes `activeBP` state → sidebar Grid Settings shows that BP's values → preview wraps in `.vp-frame`
- `.admin-preview.device-mode` class (not inline style) drives the surround color, theme-aware

## API routes
| Method | Path | What it does |
|--------|------|--------------|
| GET | /api/config | Read config.json |
| PUT | /api/config | Write config.json (full replace) |
| GET | /api/assets | Scan Assets/ → `{ "FolderName": ["Assets/.../file.png"] }` |
| POST | /api/clients | Create project (mkdir + config entry) |
| POST | /api/upload/:clientId | Upload media files to project folder |
| POST | /api/logo/site | Upload site logo → Assets/logo.ext |
| DELETE | /api/logo/site | Remove site logo from config |
| POST | /api/logo/project/:projectId | Upload project logo → Assets/Name/logo.ext |
| DELETE | /api/logo/project/:projectId | Remove project logo from config |

No auth — admin is local/private use only.

## Git workflow
Commit after each meaningful change. Assets/ and tmp/ are gitignored.
