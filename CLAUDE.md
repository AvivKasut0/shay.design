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
admin.html      admin panel SPA (iframe-based preview)
server.js       Express backend + all API routes
css/style.css   portfolio styles + dark mode + CSS custom property hooks
css/admin.css   admin styles + dark mode
js/main.js      portfolio renderer (router, lightbox, theme toggle, IS_PREVIEW mode)
js/admin.js     admin panel (sidebar controls, iframe messaging, CRUD, drag-reorder)
js/config.json  all content: designer info + styles + projects + assets
```

## Key architecture

### Config shape
```json
{
  "designer": {
    "name": "Shay Design",
    "tagline": "...",
    "logo": "Assets/logo.png",
    "email": "...",
    "social": { "instagram": "...", "linkedin": "...", "behance": "..." },
    "styles": {
      "heroTitleSize": 52,
      "heroTitleWeight": 300,
      "heroTitleColor": "#111111",
      "heroSubtitleSize": 16,
      "heroSubtitleColor": "#888888",
      "heroPaddingTop": 88,
      "heroPaddingBottom": 64,
      "projectTitleSize": 28,
      "projectTitleWeight": 300,
      "projectTitleColor": "#111111"
    }
  },
  "clients": [{
    "id": "animal-care",
    "name": "Animal Care",
    "category": "Social Media",
    "logo": "Assets/Animal Care/logo.png",
    "tileSize": "featured",
    "logoSize": 120,
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

### Typography (CSS custom properties)
`designer.styles` keys map to CSS vars set on `<html>` by `applyStylesObj()` in main.js:

| Config key | CSS var | Fallback |
|---|---|---|
| `heroTitleSize` | `--hero-title-size` | `clamp(2.8rem, 7vw, 5.5rem)` |
| `heroTitleWeight` | `--hero-title-weight` | `300` |
| `heroTitleColor` | `--hero-title-color` | `var(--text)` |
| `heroSubtitleSize` | `--hero-subtitle-size` | `clamp(0.875rem, 1.4vw, 1.05rem)` |
| `heroSubtitleColor` | `--hero-subtitle-color` | `var(--text-muted)` |
| `heroPaddingTop` | `--hero-pt` | `88px` |
| `heroPaddingBottom` | `--hero-pb` | `64px` |
| `projectTitleSize` | `--proj-title-size` | `clamp(1.4rem, 3vw, 2.2rem)` |
| `projectTitleWeight` | `--proj-title-weight` | `300` |
| `projectTitleColor` | `--proj-title-color` | `var(--text)` |

When a key is `null`/absent, the CSS var is removed and the fallback applies (auto follows dark/light theme).

### Grid per-breakpoint
- Base grid settings live on `client.grid` directly
- Breakpoint overrides: `client.grid.tablet = {...}`, `client.grid.mobile = {...}`
- `resolveGrid(rawGrid)` in main.js merges base + override for current viewport
- `resolvedG(client)` in admin.js does the same using `activeBP` state
- `align-items: stretch` + `grid-auto-rows: Npx` when `rowHeight > 0`
- Asset `cols`/`rows` are clamped to `g.columns` on render

### Home tiles
- Only one tile style: logo + name + piece count (no tile style picker)
- `client.tileSize` controls bento grid span: `normal | wide | large | featured | hero`
- `client.logoSize` (px, default 120) applied as inline `style="max-height:Npx"` on the tile `<img>`

### Dark mode
- Inline `<head>` script reads `localStorage.theme` or `prefers-color-scheme` → sets `data-theme` on `<html>`
- CSS: `[data-theme="dark"] { --bg: ...; }` + component overrides in both style.css and admin.css
- Toggle button appended to nav (live site) and admin bar (admin) by JS

---

## Admin preview — iframe + postMessage

The admin preview is a real `<iframe src="/?preview=1">` rendering the actual live site. This gives pixel-perfect 1:1 accuracy — the same CSS runs in both admin and live.

### IS_PREVIEW mode (main.js)
Detected via `var IS_PREVIEW = /[?&]preview=1/.test(location.search)`. When true:
- No lightbox, no theme toggle, no hash routing
- Tile clicks → `postMessage({type:'tile-click', index})` to parent instead of navigating
- Asset clicks → `postMessage({type:'asset-click', index})`
- Back button → `postMessage({type:'navigate-home'})`
- Asset tiles get `draggable="true"`; drag events → `postMessage({type:'asset-drop', from, to})`

### Messages: admin → iframe

| type | Payload | Effect in iframe |
|---|---|---|
| `preview-update` | `{config, route}` | Full re-render (structural changes only) |
| `styles-update` | `{styles}` | Calls `applyStylesObj()` — CSS vars only, no re-render |
| `hero-text-update` | `{name, tagline, logo}` | Updates `h1`, `p`, `document.title`, footer in place |
| `project-text-update` | `{name, category}` | Updates page title span + breadcrumb |
| `logo-size-update` | `{clientIndex, size}` | Sets `img.style.maxHeight` on one tile |
| `tile-attr-update` | `{clientIndex, tileSize}` | Sets `data-size` on one tile |
| `asset-span-update` | `{assetIndex, cols, rows, totalCols}` | Sets `style.cssText` on one asset tile |
| `grid-style-update` | `{style}` | Sets `#asset-grid` style attribute |
| `preview-select` | `{page, index}` | Adds `.preview-selected` outline to element |
| `theme-change` | `{theme}` | Sets `data-theme` on iframe `<html>` |

**Rule:** Only send `preview-update` for structural changes (navigation, add/remove assets, logo upload, column count change). All live-editing controls use targeted messages so the iframe never re-renders and there's no blink.

### Messages: iframe → admin

| type | Payload | Admin response |
|---|---|---|
| `tile-click` | `{index}` | Sets `selectedIndex`, re-renders sidebar, sends `preview-select` |
| `asset-click` | `{index}` | Sets `selectedIndex`, re-renders sidebar, sends `preview-select` |
| `asset-drop` | `{from, to}` | Reorders `client.assets`, markDirty, sends `preview-update` |
| `navigate-home` | — | Sets `view='home'`, calls `renderAll()` |

### Viewport simulation
`applyViewport()` in admin.js sets `$frame.style.maxWidth`:
- Desktop → no maxWidth (fills available space)
- Tablet → `768px` (triggers `getBreakpoint()='tablet'` inside iframe)
- Mobile → `390px` (triggers `getBreakpoint()='mobile'` inside iframe)

`.admin-preview.device-mode` class drives the surrounding grey color (theme-aware via CSS).

---

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

No auth — admin is local/private use only. All config is persisted to `js/config.json` on disk.

## Deployment
- **Admin**: requires Node.js server — local only (or a VPS/PaaS like Railway/Render)
- **Portfolio**: static-file compatible — can deploy `index.html` + `css/` + `js/` + `Assets/` to GitHub Pages or any CDN. The admin writes `config.json` locally; commit it to publish updates.

## Git workflow
Commit after each meaningful change. Assets/ and tmp/ are gitignored.
