(function () {
  'use strict';

  // ── Theme ─────────────────────────────────────────────────────────────────
  (function () {
    var t = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  })();

  function themeIcon() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.07" y2="19.07"/><line x1="4.93" y1="19.07" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.07" y2="4.93"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // ── VP icons ──────────────────────────────────────────────────────────────
  var VP_ICONS = {
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    tablet:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    mobile:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  var config          = null;
  var availableFiles  = {};
  var view            = 'home';
  var selectedIndex   = -1;
  var dragSrcIndex    = -1;
  var dirty           = false;
  var activeBP        = 'desktop';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var $tabs        = document.getElementById('admin-tabs');
  var $sidebar     = document.getElementById('sidebar');
  var $preview     = document.getElementById('preview-inner');
  var $toolbar     = document.getElementById('preview-toolbar');
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

  function projectLogoSrc(client) {
    if (client.logo) return client.logo;
    var folder = clientFolder(client);
    return folder ? folder + '/logo.png' : '';
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

  function setDeviceMode(active) {
    var previewEl = document.getElementById('preview');
    previewEl.style.background = '';
    if (active) previewEl.classList.add('device-mode');
    else        previewEl.classList.remove('device-mode');
  }

  // ── Theme toggle in admin bar ─────────────────────────────────────────────
  (function () {
    var btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.style.cssText = 'padding:5px 8px;display:inline-flex;align-items:center;';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.innerHTML = themeIcon();
    document.querySelector('.admin-actions').prepend(btn);
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      btn.innerHTML = themeIcon();
      // Refresh device-mode class so dark vp-frame picks up instantly
      setDeviceMode(activeBP !== 'desktop' && view !== 'home');
    });
  })();

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
    renderToolbar();
    renderSidebar();
    renderPreview();
    if ($viewSiteBtn) {
      $viewSiteBtn.href = view === 'home' ? '/' : '/#client/' + view;
    }
  }

  // ── Viewport toolbar ──────────────────────────────────────────────────────
  function renderToolbar() {
    if (view === 'home') { $toolbar.innerHTML = ''; return; }

    var bps = [
      { id: 'desktop', label: 'Desktop' },
      { id: 'tablet',  label: 'Tablet · 768px' },
      { id: 'mobile',  label: 'Mobile · 390px' },
    ];
    var html = '';
    bps.forEach(function (bp) {
      html += '<button class="vp-btn' + (activeBP === bp.id ? ' active' : '') + '" data-bp="' + bp.id + '">' +
        VP_ICONS[bp.id] + bp.label +
        '</button>';
    });
    $toolbar.innerHTML = html;

    $toolbar.querySelectorAll('.vp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeBP = btn.dataset.bp;
        renderAll();
      });
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function renderTabs() {
    var html = '<button class="tab-btn' + (view === 'home' ? ' active' : '') + '" data-view="home">Home</button>';
    config.clients.forEach(function (c) {
      html += '<button class="tab-btn' + (view === c.id ? ' active' : '') + '" data-view="' + escAttr(c.id) + '">' + esc(c.name) + '</button>';
    });
    html += '<button class="tab-btn tab-new" id="btn-new-project" title="New project">+</button>';
    $tabs.innerHTML = html;

    $tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn || !btn.dataset.view) return;
      view = btn.dataset.view;
      selectedIndex = -1;
      renderAll();
    });

    var newBtn = document.getElementById('btn-new-project');
    if (newBtn) {
      newBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var name = prompt('New project name:');
        if (!name || !name.trim()) return;
        var category = prompt('Category (e.g. Branding, Social Media):') || '';
        fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), category: category.trim() }),
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          config.clients.push(data.client);
          return fetch('/api/assets').then(function (r) { return r.json(); }).then(function (files) {
            availableFiles = files;
            view = data.id;
            selectedIndex = -1;
            renderAll();
          });
        })
        .catch(function (e) { alert('Error: ' + e.message); });
      });
    }
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  function renderSidebar() {
    if (view === 'home') renderHomeSidebar();
    else                 renderProjectSidebar();
  }

  function logoFieldHTML(src, inputId, removeBtnId) {
    var v = Date.now();
    var html = '<div class="logo-field">';
    if (src) {
      html += '<img class="logo-preview" src="' + escAttr(src) + '?v=' + v + '" onerror="this.style.display=\'none\'">';
      html += '<div class="logo-actions">';
      html += '<label class="btn-upload-label"><input type="file" id="' + inputId + '" accept="image/*" style="display:none"><span>Change</span></label>';
      html += '<button class="btn-remove" id="' + removeBtnId + '">Remove</button>';
      html += '</div>';
    } else {
      html += '<label class="btn-upload-label"><input type="file" id="' + inputId + '" accept="image/*" style="display:none"><span>↑ Upload Logo</span></label>';
    }
    html += '</div>';
    return html;
  }

  function renderHomeSidebar() {
    var logo = config.designer.logo;
    var html = '<div class="sidebar-section">';
    html += '<p class="section-title">General Settings</p>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Title</span><input type="text" class="ctrl-text" id="edit-site-title" value="' + escAttr(config.designer.name) + '"></div>';
    html += '<span class="ctrl-label" style="display:block;margin-top:10px;margin-bottom:6px">Site Logo</span>';
    html += logoFieldHTML(logo, 'site-logo-input', 'btn-remove-site-logo');
    html += '</div>';

    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Home Tiles</p>';
    html += '<p style="font-size:12px;color:var(--muted);line-height:1.6">Click a project tile to change its home page size.</p>';
    html += '</div>';

    if (selectedIndex >= 0) {
      var c = config.clients[selectedIndex];
      html += '<div class="sidebar-section">';
      html += '<p class="section-title">' + esc(c.name) + '</p>';
      html += tileSizeSelector(c.tileSize || 'featured');
      html += '</div>';
    }

    $sidebar.innerHTML = html;

    var titleInput = document.getElementById('edit-site-title');
    if (titleInput) {
      titleInput.addEventListener('input', function () {
        config.designer.name = this.value;
        markDirty();
      });
    }

    var siteLogoInput = document.getElementById('site-logo-input');
    if (siteLogoInput) {
      siteLogoInput.addEventListener('change', function () {
        if (!this.files[0]) return;
        var fd = new FormData();
        fd.append('logo', this.files[0]);
        fetch('/api/logo/site', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          config.designer.logo = data.logo;
          markDirty();
          renderAll();
        });
      });
    }

    var removeSiteLogoBtn = document.getElementById('btn-remove-site-logo');
    if (removeSiteLogoBtn) {
      removeSiteLogoBtn.addEventListener('click', function () {
        fetch('/api/logo/site', { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          delete config.designer.logo;
          markDirty();
          renderAll();
        });
      });
    }

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

  function tileSizeSelector(current) {
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

  function renderProjectSidebar() {
    var client = currentClient();
    if (!client) return;
    var g = resolvedG(client);

    // ── Project Info ──
    var logoSrc = projectLogoSrc(client);
    var html = '<div class="sidebar-section">';
    html += '<p class="section-title">Project</p>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Name</span><input type="text" class="ctrl-text" id="edit-client-name" value="' + escAttr(client.name) + '"></div>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Category</span><input type="text" class="ctrl-text" id="edit-client-category" value="' + escAttr(client.category || '') + '"></div>';
    html += '<span class="ctrl-label" style="display:block;margin-top:10px;margin-bottom:6px">Logo</span>';
    html += logoFieldHTML(logoSrc, 'proj-logo-input', 'btn-remove-proj-logo');
    html += '<button class="btn-remove" id="btn-delete-client" style="margin-top:12px">Delete Project</button>';
    html += '</div>';

    // ── Grid Settings — label shows current BP ──
    var bpLabel = activeBP === 'desktop' ? '' : ' · ' + activeBP.charAt(0).toUpperCase() + activeBP.slice(1);
    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Grid Settings<span style="text-transform:none;font-weight:400;letter-spacing:0;opacity:0.6">' + bpLabel + '</span></p>';
    html += sliderRow('Columns',    'columns',       g.columns,       1, 8,   1, '');
    html += sliderRow('Row Height', 'rowHeight',     g.rowHeight||0,  0, 800, 10,'px');
    html += sliderRow('Gutter',     'gap',           g.gap,           0, 60,  1, 'px');
    html += sliderRow('Width %',    'width',         g.width,         20,100, 1, '%');
    html += numRow   ('Max Width',  'maxWidth',      g.maxWidth||0,       'px');
    html += sliderRow('Above',      'paddingTop',    g.paddingTop,    0, 200, 4, 'px');
    html += sliderRow('Below',      'paddingBottom', g.paddingBottom, 0, 200, 4, 'px');
    html += '</div>';

    // ── Selected asset ──
    if (selectedIndex >= 0 && client.assets[selectedIndex]) {
      var asset = client.assets[selectedIndex];
      html += '<div class="sidebar-section">';
      html += '<p class="section-title">Selected Image</p>';
      html += '<img class="selected-thumb" src="' + escAttr(asset.file) + '" onerror="this.style.display=\'none\'">';
      html += sliderRow('Col span', 'asset-cols', asset.cols||1, 1, g.columns, 1, '');
      html += sliderRow('Row span', 'asset-rows', asset.rows||1, 1, 6,         1, '');
      html += '<button class="btn-remove" id="btn-remove">Remove from grid</button>';
      html += '</div>';
    }

    // ── Available files ──
    var folder    = clientFolder(client);
    var folderKey = folder ? folder.replace('Assets/', '') : client.name;
    var allInFolder = availableFiles[folderKey] || [];
    var usedFiles   = client.assets.map(function (a) { return a.file; });
    var unused      = allInFolder.filter(function (f) { return usedFiles.indexOf(f) === -1; });

    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Add to Grid</p>';
    html += '<label class="btn-upload-label"><input type="file" id="upload-input" multiple accept="image/*,video/*,.gif,.webp,.webm,.mp4,.mov" style="display:none"><span id="upload-label-text">↑ Upload Files</span></label>';
    if (unused.length === 0) {
      html += '<p class="avail-empty">All files in this folder are in the grid.</p>';
    } else {
      html += '<div class="available-list">';
      unused.forEach(function (file) {
        html += '<div class="avail-item" data-file="' + escAttr(file) + '"><img src="' + escAttr(file) + '" loading="lazy"><div class="avail-add">+</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    $sidebar.innerHTML = html;
    bindProjectSidebarEvents(client, g);
  }

  function sliderRow(label, key, val, min, max, step, unit) {
    return (
      '<div class="ctrl-row">' +
        '<span class="ctrl-label">' + label + '</span>' +
        '<input type="range"  class="ctrl-slider" data-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
        '<input type="number" class="ctrl-num"    data-key="' + key + '" min="' + min + '" max="' + max + '" value="' + val + '">' +
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

  function bindProjectSidebarEvents(client, g) {
    // Edit name
    var nameInput = document.getElementById('edit-client-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        client.name = this.value;
        markDirty();
        renderTabs();
      });
    }

    // Edit category
    var catInput = document.getElementById('edit-client-category');
    if (catInput) {
      catInput.addEventListener('input', function () {
        client.category = this.value;
        markDirty();
      });
    }

    // Project logo upload
    var projLogoInput = document.getElementById('proj-logo-input');
    if (projLogoInput) {
      projLogoInput.addEventListener('change', function () {
        if (!this.files[0]) return;
        var fd = new FormData();
        fd.append('logo', this.files[0]);
        fetch('/api/logo/project/' + client.id, { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          client.logo = data.logo;
          markDirty();
          renderAll();
        });
      });
    }

    // Remove project logo
    var removeProjLogo = document.getElementById('btn-remove-proj-logo');
    if (removeProjLogo) {
      removeProjLogo.addEventListener('click', function () {
        fetch('/api/logo/project/' + client.id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          delete client.logo;
          markDirty();
          renderAll();
        });
      });
    }

    // Delete project
    var deleteBtn = document.getElementById('btn-delete-client');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!confirm('Remove "' + client.name + '" from portfolio? (Assets folder is kept)')) return;
        var idx = config.clients.indexOf(client);
        if (idx >= 0) config.clients.splice(idx, 1);
        view = 'home';
        selectedIndex = -1;
        fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        }).catch(function () {});
        dirty = false;
        renderAll();
      });
    }

    // Upload files
    var uploadInput = document.getElementById('upload-input');
    if (uploadInput) {
      uploadInput.addEventListener('change', function () {
        if (!this.files.length) return;
        var labelText = document.getElementById('upload-label-text');
        if (labelText) labelText.textContent = 'Uploading…';
        var formData = new FormData();
        Array.prototype.forEach.call(this.files, function (f) { formData.append('files', f); });
        fetch('/api/upload/' + client.id, { method: 'POST', body: formData })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert('Upload failed: ' + data.error); renderSidebar(); return; }
          return fetch('/api/assets').then(function (r) { return r.json(); }).then(function (files) {
            availableFiles = files;
            renderSidebar();
          });
        })
        .catch(function (e) { alert('Upload error: ' + e.message); renderSidebar(); });
      });
    }

    // Grid sliders + number inputs
    $sidebar.querySelectorAll('[data-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.key;
        var val = parseFloat(el.value);

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

        if (!client.grid) client.grid = {};
        if (activeBP === 'desktop') {
          client.grid[key] = val;
        } else {
          if (!client.grid[activeBP]) client.grid[activeBP] = {};
          client.grid[activeBP][key] = val;
        }
        markDirty();
        $sidebar.querySelectorAll('[data-key="' + key + '"]').forEach(function (s) { s.value = val; });
        if (key === 'columns') { selectedIndex = -1; renderSidebar(); }
        renderPreview();
      });
    });

    // Remove asset from grid
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

    // Add available file to grid
    $sidebar.querySelectorAll('.avail-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var file = el.dataset.file;
        client.assets.push({ file: file, type: guessType(file) });
        markDirty();
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
    setDeviceMode(false);
    var html = '<p class="preview-section-label">Home Page</p>';
    html += '<div class="bento home-preview">';

    config.clients.forEach(function (client, ci) {
      var size   = client.tileSize || 'featured';
      var logo   = projectLogoSrc(client);
      var count  = client.assets.length;
      var active = selectedIndex === ci ? ' style="outline:2px solid #111;"' : '';
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
    var g = resolvedG(client);

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
      var cols     = asset.cols || 1;
      var rows     = asset.rows || 1;
      var colStyle = cols > 1 ? 'grid-column:span ' + Math.min(cols, g.columns) : '';
      var rowStyle = rows > 1 ? 'grid-row:span ' + rows : '';
      var spanCSS  = [colStyle, rowStyle].filter(Boolean).join(';');
      var rowsAttr = rows > 1 ? ' data-rows="' + rows + '"' : '';
      var sel      = i === selectedIndex ? ' selected' : '';
      var align    = (g.rowHeight > 0 || rows > 1) ? 'align-self:stretch;' : '';
      var imgStyle = 'width:100%;height:auto;display:block;pointer-events:none';
      var media    = asset.type === 'video'
        ? '<video src="' + escAttr(asset.file) + '" muted autoplay loop playsinline style="' + imgStyle + '"></video>'
        : '<img src="' + escAttr(asset.file) + '" loading="lazy" style="' + imgStyle + '">';

      items += (
        '<div class="preview-tile' + sel + '"' + rowsAttr + ' draggable="true" data-index="' + i + '" style="' + align + spanCSS + '">' +
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

    var isDevice = activeBP !== 'desktop';
    var maxW  = activeBP === 'mobile' ? '390px' : activeBP === 'tablet' ? '768px' : '';
    var vpOpen  = isDevice ? '<div class="vp-frame" style="max-width:' + maxW + ';margin:0 auto">' : '';
    var vpClose = isDevice ? '</div>' : '';

    setDeviceMode(isDevice);

    $preview.innerHTML =
      vpOpen +
      '<div class="preview-grid" style="' + style + '" id="preview-grid">' + items + '</div>' +
      vpClose;

    bindPreviewEvents(client, g);
  }

  function bindPreviewEvents(client, g) {
    var grid = document.getElementById('preview-grid');
    if (!grid) return;

    grid.addEventListener('click', function (e) {
      var tile = e.target.closest('.preview-tile');
      if (!tile) return;
      var idx = parseInt(tile.dataset.index, 10);

      if (e.target.closest('.btn-wider')) {
        var a = client.assets[idx];
        a.cols = Math.min(g.columns, (a.cols || 1) + 1);
        if (a.cols === 1) delete a.cols;
        markDirty(); renderSidebar(); renderPreview(); return;
      }
      if (e.target.closest('.btn-narrower')) {
        var a2 = client.assets[idx];
        if ((a2.cols || 1) > 1) a2.cols = (a2.cols || 1) - 1; else delete a2.cols;
        markDirty(); renderSidebar(); renderPreview(); return;
      }
      if (e.target.closest('.btn-taller')) {
        var a3 = client.assets[idx];
        a3.rows = (a3.rows || 1) + 1;
        markDirty(); renderSidebar(); renderPreview(); return;
      }
      if (e.target.closest('.btn-shorter')) {
        var a4 = client.assets[idx];
        var cur = a4.rows || 1;
        if (cur > 1) a4.rows = cur - 1; else delete a4.rows;
        if ((a4.rows || 1) === 1) delete a4.rows;
        markDirty(); renderSidebar(); renderPreview(); return;
      }

      selectedIndex = idx === selectedIndex ? -1 : idx;
      renderSidebar();
      renderPreview();
    });

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
      if (tile && parseInt(tile.dataset.index, 10) !== dragSrcIndex) tile.classList.add('drag-over');
    });

    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      var tile = e.target.closest('.preview-tile');
      if (!tile) return;
      var destIndex = parseInt(tile.dataset.index, 10);
      if (dragSrcIndex === destIndex) return;
      var moved = client.assets.splice(dragSrcIndex, 1)[0];
      client.assets.splice(destIndex, 0, moved);
      if      (selectedIndex === dragSrcIndex)                               selectedIndex = destIndex;
      else if (selectedIndex > dragSrcIndex && selectedIndex <= destIndex)   selectedIndex--;
      else if (selectedIndex < dragSrcIndex && selectedIndex >= destIndex)   selectedIndex++;
      markDirty();
      renderAll();
    });
  }

  // ── Keyboard shortcut: Cmd/Ctrl+S ────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      $save.click();
    }
  });

}());
