(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  var config          = null;   // full config object from /api/config
  var availableFiles  = {};     // { "ClientName": ["Assets/ClientName/file.png", ...] }
  var view            = 'home'; // 'home' | client id string
  var selectedIndex   = -1;     // index of selected asset in current client
  var dragSrcIndex    = -1;
  var dirty           = false;
  var activeBP        = 'desktop'; // 'desktop' | 'tablet' | 'mobile'

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var $tabs        = document.getElementById('admin-tabs');
  var $sidebar     = document.getElementById('sidebar');
  var $preview     = document.getElementById('preview-inner');
  var $save        = document.getElementById('btn-save');
  var $viewSiteBtn = document.querySelector('.btn-ghost[href="/"]');

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function currentClient() {
    if (view === 'home') return null;
    return config.clients.find(function (c) { return c.id === view; }) || null;
  }

  function defaultGrid() {
    return { columns: 3, gap: 10, width: 100, maxWidth: 0, paddingTop: 40, paddingBottom: 0, rowHeight: 0 };
  }

  function clientFolder(client) {
    var first = client.assets[0] && client.assets[0].file;
    if (!first) return null;
    return first.substring(0, first.lastIndexOf('/'));
  }

  function guessType(file) {
    var ext = file.split('.').pop().toLowerCase();
    if (ext === 'gif') return 'gif';
    if (ext === 'mp4' || ext === 'webm' || ext === 'mov') return 'video';
    return 'image';
  }

  function markDirty() {
    dirty = true;
    $save.textContent = 'Save';
    $save.classList.remove('saved');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  Promise.all([
    fetch('/api/config').then(function (r) { return r.json(); }),
    fetch('/api/assets').then(function (r) { return r.json(); }),
  ]).then(function (results) {
    config         = results[0];
    availableFiles = results[1];
    renderAll();
  }).catch(function () {
    $preview.innerHTML = '<p style="padding:2rem;color:#888">Could not load config.</p>';
  });

  // ── Save ──────────────────────────────────────────────────────────────────
  $save.addEventListener('click', function () {
    $save.textContent = 'Saving…';
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    .then(function (r) { return r.json(); })
    .then(function () {
      dirty = false;
      $save.textContent = 'Saved ✓';
      $save.classList.add('saved');
      setTimeout(function () {
        if (!dirty) { $save.textContent = 'Save'; $save.classList.remove('saved'); }
      }, 2500);
    })
    .catch(function () { $save.textContent = 'Error — try again'; });
  });

  // ── Render all ────────────────────────────────────────────────────────────
  function renderAll() {
    renderTabs();
    renderSidebar();
    renderPreview();
    if ($viewSiteBtn) {
      $viewSiteBtn.href = view === 'home' ? '/' : '/#client/' + view;
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function renderTabs() {
    var html = '<button class="tab-btn' + (view === 'home' ? ' active' : '') + '" data-view="home">Home</button>';
    config.clients.forEach(function (c) {
      html += '<button class="tab-btn' + (view === c.id ? ' active' : '') + '" data-view="' + escAttr(c.id) + '">' + esc(c.name) + '</button>';
    });
    $tabs.innerHTML = html;
    $tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      view = btn.dataset.view;
      selectedIndex = -1;
      renderAll();
    });
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  function renderSidebar() {
    if (view === 'home') renderHomeSidebar();
    else                 renderClientSidebar();
  }

  function renderHomeSidebar() {
    var html = '<div class="sidebar-section">';
    html += '<p class="section-title">Home Tiles</p>';
    html += '<p style="font-size:12px;color:#888;line-height:1.6">Click a client tile in the preview to change its home page size.</p>';
    html += '</div>';

    if (selectedIndex >= 0) {
      var c = config.clients[selectedIndex];
      var size = c.tileSize || 'featured';
      html += '<div class="sidebar-section">';
      html += '<p class="section-title">' + esc(c.name) + ' Tile</p>';
      html += tileSizeSelector(size, 'home-tile-size');
      html += '</div>';
    }

    $sidebar.innerHTML = html;

    if (selectedIndex >= 0) {
      $sidebar.querySelectorAll('.size-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          config.clients[selectedIndex].tileSize = btn.dataset.size;
          markDirty();
          renderAll();
        });
      });
    }
  }

  function tileSizeSelector(current, id) {
    var sizes = ['normal', 'wide', 'large', 'featured', 'hero'];
    var html  = '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">';
    sizes.forEach(function (s) {
      html += '<button class="size-btn' + (current === s ? ' active' : '') + '" data-size="' + s + '" style="padding:4px 10px;border:1px solid ' + (current===s ? '#111' : '#ddd') + ';border-radius:3px;font-size:11px;background:' + (current===s ? '#111' : '#fff') + ';color:' + (current===s ? '#fff' : '#555') + ';cursor:pointer;">' + s + '</button>';
    });
    html += '</div>';
    return html;
  }

  function resolvedG(client) {
    var rawGrid = client.grid || {};
    var base = Object.assign({}, defaultGrid(), rawGrid);
    delete base.tablet; delete base.mobile;
    if (activeBP === 'tablet') return Object.assign({}, base, rawGrid.tablet || {});
    if (activeBP === 'mobile') return Object.assign({}, base, rawGrid.mobile || {});
    return base;
  }

  function renderClientSidebar() {
    var client = currentClient();
    if (!client) return;
    var g = resolvedG(client);

    // ── Grid Settings ──
    var html = '<div class="sidebar-section">';
    html += '<p class="section-title">Grid Settings</p>';
    html += '<div class="bp-tabs">';
    ['desktop','tablet','mobile'].forEach(function(bp) {
      html += '<button class="bp-btn' + (activeBP === bp ? ' active' : '') + '" data-bp="' + bp + '">' + bp.charAt(0).toUpperCase() + bp.slice(1) + '</button>';
    });
    html += '</div>';
    html += sliderRow('Columns',    'columns',      g.columns,      1, 8,   1, '');
    html += sliderRow('Row Height', 'rowHeight',    g.rowHeight || 0, 0, 800, 10, 'px');
    html += sliderRow('Gutter',     'gap',          g.gap,          0, 60,  1, 'px');
    html += sliderRow('Width %',    'width',        g.width,        20,100, 1, '%');
    html += numRow('Max Width',     'maxWidth',     g.maxWidth || 0,    'px');
    html += sliderRow('Above',      'paddingTop',   g.paddingTop,   0, 200, 4, 'px');
    html += sliderRow('Below',      'paddingBottom',g.paddingBottom,0, 200, 4, 'px');
    html += '</div>';

    // ── Selected asset ──
    if (selectedIndex >= 0 && client.assets[selectedIndex]) {
      var asset = client.assets[selectedIndex];
      var cols  = asset.cols || 1;
      var rows  = asset.rows || 1;
      html += '<div class="sidebar-section">';
      html += '<p class="section-title">Selected Image</p>';
      html += '<img class="selected-thumb" src="' + escAttr(asset.file) + '" onerror="this.style.display=\'none\'">';
      html += sliderRow('Col span', 'asset-cols', cols, 1, g.columns, 1, '');
      html += sliderRow('Row span', 'asset-rows', rows, 1, 6,         1, '');
      html += '<button class="btn-remove" id="btn-remove">Remove from grid</button>';
      html += '</div>';
    }

    // ── Available files to add ──
    var folder  = clientFolder(client);
    var allInFolder = folder ? (availableFiles[folder.replace('Assets/', '')] || []) : [];
    var usedFiles   = client.assets.map(function (a) { return a.file; });
    var unused      = allInFolder.filter(function (f) { return usedFiles.indexOf(f) === -1; });

    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Add to Grid</p>';
    if (unused.length === 0) {
      html += '<p class="avail-empty">All files in this folder are already in the grid.</p>';
    } else {
      html += '<div class="available-list">';
      unused.forEach(function (file) {
        html += '<div class="avail-item" data-file="' + escAttr(file) + '"><img src="' + escAttr(file) + '" loading="lazy"><div class="avail-add">+</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    $sidebar.innerHTML = html;
    bindSidebarEvents(client, g);
  }

  function sliderRow(label, key, val, min, max, step, unit) {
    return (
      '<div class="ctrl-row">' +
        '<span class="ctrl-label">' + label + '</span>' +
        '<input type="range" class="ctrl-slider" data-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
        '<input type="number" class="ctrl-num" data-key="' + key + '" min="' + min + '" max="' + max + '" value="' + val + '">' +
        (unit ? '<span class="ctrl-unit">' + unit + '</span>' : '') +
      '</div>'
    );
  }

  function numRow(label, key, val, unit) {
    return (
      '<div class="ctrl-row">' +
        '<span class="ctrl-label">' + label + '</span>' +
        '<input type="number" class="ctrl-num" data-key="' + key + '" min="0" value="' + val + '" style="width:80px">' +
        (unit ? '<span class="ctrl-unit">' + unit + '</span>' : '') +
      '</div>'
    );
  }

  function bindSidebarEvents(client, g) {
    // Grid sliders + number inputs — keep them in sync
    $sidebar.querySelectorAll('[data-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.key;
        var val = parseFloat(el.value);

        // Asset cols
        if (key === 'asset-cols') {
          if (selectedIndex >= 0 && client.assets[selectedIndex]) {
            var cols = Math.max(1, Math.min(g.columns, Math.round(val)));
            if (cols === 1) delete client.assets[selectedIndex].cols;
            else client.assets[selectedIndex].cols = cols;
            markDirty();
            $sidebar.querySelectorAll('[data-key="asset-cols"]').forEach(function (s) { s.value = cols; });
            renderPreview();
          }
          return;
        }

        // Asset rows
        if (key === 'asset-rows') {
          if (selectedIndex >= 0 && client.assets[selectedIndex]) {
            var rowsVal = Math.max(1, Math.round(val));
            if (rowsVal === 1) delete client.assets[selectedIndex].rows;
            else client.assets[selectedIndex].rows = rowsVal;
            markDirty();
            $sidebar.querySelectorAll('[data-key="asset-rows"]').forEach(function (s) { s.value = rowsVal; });
            renderPreview();
          }
          return;
        }

        // Grid settings — write to correct breakpoint
        if (!client.grid) client.grid = {};
        if (activeBP === 'desktop') {
          client.grid[key] = val;
        } else {
          if (!client.grid[activeBP]) client.grid[activeBP] = {};
          client.grid[activeBP][key] = val;
        }
        markDirty();

        // Sync slider ↔ number
        $sidebar.querySelectorAll('[data-key="' + key + '"]').forEach(function (s) { s.value = val; });

        if (key === 'columns') { selectedIndex = -1; renderSidebar(); }
        renderPreview();
      });
    });

    // Remove asset
    var removeBtn = document.getElementById('btn-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (selectedIndex < 0) return;
        client.assets.splice(selectedIndex, 1);
        selectedIndex = -1;
        markDirty();
        renderAll();
      });
    }

    // Add available file
    $sidebar.querySelectorAll('.avail-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var file = el.dataset.file;
        client.assets.push({ file: file, type: guessType(file) });
        markDirty();
        renderAll();
      });
    });

    // Breakpoint tabs
    $sidebar.querySelectorAll('.bp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeBP = btn.dataset.bp;
        renderAll();
      });
    });
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  function renderPreview() {
    if (view === 'home') renderHomePreview();
    else                 renderClientPreview();
  }

  function renderHomePreview() {
    document.getElementById('preview').style.background = '';
    var html = '<p class="preview-section-label">Home Page</p>';
    html += '<div class="bento home-preview">';

    config.clients.forEach(function (client, ci) {
      var size    = client.tileSize || 'featured';
      var folder  = clientFolder(client);
      var logo    = folder ? (folder + '/logo.png') : '';
      var count   = client.assets.length;
      var active  = selectedIndex === ci ? ' style="outline:2px solid #111;"' : '';
      html += '<div class="bento-item" data-size="' + size + '" data-ci="' + ci + '"' + active + '>';
      if (logo) html += '<img src="' + escAttr(logo) + '" onerror="this.style.display=\'none\'">';
      html += '<div class="tile-info"><span class="tile-name">' + esc(client.name) + '</span><span class="tile-count">' + count + ' pieces</span></div>';
      html += '</div>';
    });

    html += '</div>';
    $preview.innerHTML = html;

    $preview.querySelectorAll('.bento-item[data-ci]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () {
        selectedIndex = parseInt(el.dataset.ci, 10);
        renderAll();
      });
    });
  }

  function renderClientPreview() {
    var client = currentClient();
    if (!client) return;
    var g     = resolvedG(client);
    var styleParts = [
      'display:grid',
      'grid-template-columns:repeat(' + g.columns + ',1fr)',
      'gap:' + g.gap + 'px',
      'width:' + g.width + '%',
      'padding-top:' + g.paddingTop + 'px',
      'padding-bottom:' + g.paddingBottom + 'px',
      'margin:0 auto',
      g.rowHeight ? 'align-items:stretch' : 'align-items:start',
    ];
    if (g.maxWidth)  styleParts.push('max-width:' + g.maxWidth + 'px');
    if (g.rowHeight) styleParts.push('grid-auto-rows:' + g.rowHeight + 'px');
    var style = styleParts.join(';');

    var items = '';
    client.assets.forEach(function (asset, i) {
      var cols      = asset.cols || 1;
      var rows      = asset.rows || 1;
      var colStyle  = cols > 1 ? 'grid-column:span ' + Math.min(cols, g.columns) : '';
      var rowStyle  = rows > 1 ? 'grid-row:span ' + rows : '';
      var spanCSS   = [colStyle, rowStyle].filter(Boolean).join(';');
      var rowsAttr  = rows > 1 ? ' data-rows="' + rows + '"' : '';
      var sel       = i === selectedIndex ? ' selected' : '';
      var alignSelf = (g.rowHeight > 0 || rows > 1) ? 'align-self:stretch;' : '';
      var imgStyle  = 'width:100%;height:auto;display:block;pointer-events:none';
      var media    = asset.type === 'video'
        ? '<video src="' + escAttr(asset.file) + '" muted autoplay loop playsinline style="' + imgStyle + '"></video>'
        : '<img src="' + escAttr(asset.file) + '" loading="lazy" style="' + imgStyle + '">';

      items += (
        '<div class="preview-tile' + sel + '"' + rowsAttr + ' draggable="true" data-index="' + i + '" style="' + alignSelf + spanCSS + '">' +
          media +
          '<div class="tile-controls">' +
            '<button class="tile-ctrl-btn btn-wider"    title="Wider">⟷</button>' +
            '<button class="tile-ctrl-btn btn-narrower" title="Narrower">⟵</button>' +
            '<button class="tile-ctrl-btn btn-taller"   title="Taller">↕</button>' +
            '<button class="tile-ctrl-btn btn-shorter"  title="Shorter">↑</button>' +
          '</div>' +
        '</div>'
      );
    });

    var vpLabel = activeBP === 'mobile' ? 'Mobile — 390px' : activeBP === 'tablet' ? 'Tablet — 768px' : '';
    var vpOpen  = activeBP === 'mobile' ? '<div class="vp-frame" style="max-width:390px;margin:0 auto">'
                : activeBP === 'tablet' ? '<div class="vp-frame" style="max-width:768px;margin:0 auto">'
                : '';
    var vpClose = vpOpen ? '</div>' : '';

    // Darken outer canvas when simulating a device
    document.getElementById('preview').style.background = vpOpen ? '#C8C8C8' : '';

    $preview.innerHTML =
      (vpLabel ? '<div class="vp-label">' + vpLabel + '</div>' : '') +
      vpOpen +
      '<div class="preview-grid" style="' + style + '" id="preview-grid">' + items + '</div>' +
      vpClose;

    bindPreviewEvents(client, g);
  }

  function bindPreviewEvents(client, g) {
    var grid = document.getElementById('preview-grid');
    if (!grid) return;

    // Select tile
    grid.addEventListener('click', function (e) {
      var tile = e.target.closest('.preview-tile');
      if (!tile) return;
      var idx = parseInt(tile.dataset.index, 10);

      // Wider / narrower buttons
      if (e.target.closest('.btn-wider')) {
        var asset = client.assets[idx];
        var cur   = asset.cols || 1;
        asset.cols = cur >= g.columns ? g.columns : cur + 1;
        if (asset.cols === 1) delete asset.cols;
        markDirty();
        renderSidebar();
        renderPreview();
        return;
      }
      if (e.target.closest('.btn-narrower')) {
        var asset2 = client.assets[idx];
        var cur2   = asset2.cols || 1;
        if (cur2 > 1) asset2.cols = cur2 - 1; else delete asset2.cols;
        markDirty();
        renderSidebar();
        renderPreview();
        return;
      }
      if (e.target.closest('.btn-taller')) {
        var asset3 = client.assets[idx];
        var cur3   = asset3.rows || 1;
        asset3.rows = cur3 + 1;
        markDirty();
        renderSidebar();
        renderPreview();
        return;
      }
      if (e.target.closest('.btn-shorter')) {
        var asset4 = client.assets[idx];
        var cur4   = asset4.rows || 1;
        if (cur4 > 1) asset4.rows = cur4 - 1; else delete asset4.rows;
        if ((asset4.rows || 1) === 1) delete asset4.rows;
        markDirty();
        renderSidebar();
        renderPreview();
        return;
      }

      selectedIndex = idx === selectedIndex ? -1 : idx;
      renderSidebar();
      renderPreview();
    });

    // Drag to reorder
    grid.addEventListener('dragstart', function (e) {
      var tile = e.target.closest('.preview-tile');
      if (!tile) return;
      dragSrcIndex = parseInt(tile.dataset.index, 10);
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', function (e) {
      var tile = e.target.closest('.preview-tile');
      if (tile) tile.classList.remove('dragging');
      grid.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
    });

    grid.addEventListener('dragover', function (e) {
      e.preventDefault();
      var tile = e.target.closest('.preview-tile');
      grid.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
      if (tile && parseInt(tile.dataset.index, 10) !== dragSrcIndex) {
        tile.classList.add('drag-over');
      }
    });

    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      var tile = e.target.closest('.preview-tile');
      if (!tile) return;
      var destIndex = parseInt(tile.dataset.index, 10);
      if (dragSrcIndex === destIndex) return;

      var moved = client.assets.splice(dragSrcIndex, 1)[0];
      client.assets.splice(destIndex, 0, moved);

      if (selectedIndex === dragSrcIndex) selectedIndex = destIndex;
      else if (selectedIndex > dragSrcIndex && selectedIndex <= destIndex) selectedIndex--;
      else if (selectedIndex < dragSrcIndex && selectedIndex >= destIndex) selectedIndex++;

      markDirty();
      renderAll();
    });
  }

  // ── Keyboard shortcut: Cmd/Ctrl+S to save ────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      $save.click();
    }
  });

}());
