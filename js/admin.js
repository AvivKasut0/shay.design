(function () {
  'use strict';

  // ── Theme (runs immediately) ──────────────────────────────────────────────
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
  var config         = null;
  var availableFiles = {};
  var view           = 'home';
  var selectedIndex  = -1;
  var dirty          = false;
  var activeBP       = 'desktop';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var $tabs        = document.getElementById('admin-tabs');
  var $sidebar     = document.getElementById('sidebar');
  var $frame       = document.getElementById('preview-frame');
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
    if (active) previewEl.classList.add('device-mode');
    else        previewEl.classList.remove('device-mode');
  }

  // ── iframe messaging ──────────────────────────────────────────────────────
  function sendToPreview() {
    if (!$frame || !$frame.contentWindow) return;
    try {
      $frame.contentWindow.postMessage({
        type:   'preview-update',
        config: config,
        route:  view === 'home' ? '' : 'client/' + view,
      }, '*');
    } catch (e) {}
  }

  function applyViewport() {
    var isDevice = activeBP !== 'desktop';
    setDeviceMode(isDevice);
    if (activeBP === 'mobile')      $frame.style.maxWidth = '390px';
    else if (activeBP === 'tablet') $frame.style.maxWidth = '768px';
    else                            $frame.style.maxWidth = '';
  }

  // Called after each iframe load to sync current state
  $frame.addEventListener('load', function () {
    // Sync theme
    try {
      $frame.contentWindow.postMessage({
        type: 'theme-change',
        theme: document.documentElement.getAttribute('data-theme'),
      }, '*');
    } catch (e) {}
    if (config) sendToPreview();
  });

  // ── Bidirectional messages from iframe ────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var msg = e.data;

    if (msg.type === 'tile-click' && view === 'home') {
      selectedIndex = msg.index;
      renderSidebar();
      // Highlight selected tile in iframe
      try { $frame.contentWindow.postMessage({ type: 'preview-select', page: 'tile', index: selectedIndex }, '*'); } catch (ex) {}
      return;
    }

    if (msg.type === 'asset-click' && view !== 'home') {
      selectedIndex = msg.index;
      renderSidebar();
      try { $frame.contentWindow.postMessage({ type: 'preview-select', page: 'asset', index: selectedIndex }, '*'); } catch (ex) {}
      return;
    }

    if (msg.type === 'asset-drop') {
      var client = currentClient();
      if (!client) return;
      var moved = client.assets.splice(msg.from, 1)[0];
      client.assets.splice(msg.to, 0, moved);
      if      (selectedIndex === msg.from)                                   selectedIndex = msg.to;
      else if (selectedIndex > msg.from && selectedIndex <= msg.to)          selectedIndex--;
      else if (selectedIndex < msg.from && selectedIndex >= msg.to)          selectedIndex++;
      markDirty();
      renderSidebar();
      sendToPreview();
      return;
    }

    if (msg.type === 'navigate-home') {
      view = 'home';
      selectedIndex = -1;
      renderAll();
      return;
    }
  });

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
      // Sync iframe theme
      try { $frame.contentWindow.postMessage({ type: 'theme-change', theme: next }, '*'); } catch (ex) {}
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
    document.getElementById('preview-body').innerHTML = '<p style="padding:2rem;color:#888">Could not load config.</p>';
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

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); $save.click(); }
  });

  // ── Render all ────────────────────────────────────────────────────────────
  function renderAll() {
    renderTabs();
    renderToolbar();
    renderSidebar();
    sendToPreview();
    applyViewport();
    if ($viewSiteBtn) $viewSiteBtn.href = view === 'home' ? '/' : '/#client/' + view;
  }

  // ── Viewport toolbar ──────────────────────────────────────────────────────
  function renderToolbar() {
    var bps = [
      { id: 'desktop', label: 'Desktop' },
      { id: 'tablet',  label: 'Tablet · 768px' },
      { id: 'mobile',  label: 'Mobile · 390px' },
    ];
    var html = '';
    bps.forEach(function (bp) {
      html += '<button class="vp-btn' + (activeBP === bp.id ? ' active' : '') + '" data-bp="' + bp.id + '">' +
        VP_ICONS[bp.id] + bp.label + '</button>';
    });
    $toolbar.innerHTML = html;

    $toolbar.querySelectorAll('.vp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeBP = btn.dataset.bp;
        renderToolbar();
        applyViewport();
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
        .catch(function (ex) { alert('Error: ' + ex.message); });
      });
    }
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  function renderSidebar() {
    if (view === 'home') renderHomeSidebar();
    else                 renderProjectSidebar();
  }

  // ── Logo field ────────────────────────────────────────────────────────────
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

  // ── Style control rows ────────────────────────────────────────────────────
  function styleSliderRow(label, skey, val, min, max, step, unit) {
    val = (val != null) ? val : 0;
    return (
      '<div class="ctrl-row">' +
        '<span class="ctrl-label">' + label + '</span>' +
        '<input type="range"  class="ctrl-slider" data-skey="' + skey + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
        '<input type="number" class="ctrl-num"    data-skey="' + skey + '" min="' + min + '" max="' + max + '" value="' + val + '">' +
        (unit ? '<span class="ctrl-unit">' + unit + '</span>' : '') +
      '</div>'
    );
  }

  function styleColorRow(label, skey, fallback) {
    var s = config.designer.styles || {};
    var isAuto = s[skey] == null;
    var val = isAuto ? (fallback || '#111111') : s[skey];
    return (
      '<div class="ctrl-row">' +
        '<span class="ctrl-label">' + label + '</span>' +
        '<input type="color" class="ctrl-color" data-skey="' + skey + '" value="' + escAttr(val) + '">' +
        '<button class="btn-auto' + (isAuto ? ' is-auto' : '') + '" data-skey="' + skey + '" title="' + (isAuto ? 'Auto — follows theme' : 'Reset to auto') + '">' + (isAuto ? 'auto' : '✕') + '</button>' +
      '</div>'
    );
  }

  function styleWeightRow(label, skey, defaultVal) {
    var s = config.designer.styles || {};
    var val = s[skey] != null ? s[skey] : (defaultVal || 300);
    var weights = [100, 200, 300, 400, 500, 600, 700, 800];
    var html = '<div class="ctrl-row"><span class="ctrl-label">' + label + '</span>';
    html += '<select class="ctrl-select" data-skey="' + skey + '">';
    weights.forEach(function (w) {
      html += '<option value="' + w + '"' + (val == w ? ' selected' : '') + '>' + w + '</option>';
    });
    html += '</select></div>';
    return html;
  }

  function bindStyleInputs() {
    // Sliders + numbers (numeric)
    $sidebar.querySelectorAll('input[type="range"][data-skey], input[type="number"][data-skey]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.skey;
        var val = parseFloat(el.value);
        if (!config.designer.styles) config.designer.styles = {};
        config.designer.styles[key] = val;
        markDirty();
        $sidebar.querySelectorAll('[data-skey="' + key + '"]').forEach(function (s) {
          if (s !== el && (s.tagName === 'INPUT')) s.value = val;
        });
        sendToPreview();
      });
    });

    // Color inputs
    $sidebar.querySelectorAll('input[type="color"][data-skey]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.skey;
        if (!config.designer.styles) config.designer.styles = {};
        config.designer.styles[key] = this.value;
        var autoBtn = $sidebar.querySelector('.btn-auto[data-skey="' + key + '"]');
        if (autoBtn) { autoBtn.classList.remove('is-auto'); autoBtn.textContent = '✕'; autoBtn.title = 'Reset to auto'; }
        markDirty();
        sendToPreview();
      });
    });

    // Auto (reset) buttons
    $sidebar.querySelectorAll('.btn-auto[data-skey]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.dataset.skey;
        if (config.designer.styles) delete config.designer.styles[key];
        el.classList.add('is-auto');
        el.textContent = 'auto';
        el.title = 'Auto — follows theme';
        markDirty();
        sendToPreview();
      });
    });

    // Weight selects
    $sidebar.querySelectorAll('select[data-skey]').forEach(function (el) {
      el.addEventListener('change', function () {
        var key = el.dataset.skey;
        if (!config.designer.styles) config.designer.styles = {};
        config.designer.styles[key] = parseInt(this.value, 10);
        markDirty();
        sendToPreview();
      });
    });
  }

  // ── Home sidebar ──────────────────────────────────────────────────────────
  function renderHomeSidebar() {
    var s  = config.designer.styles || {};
    var html = '';

    // General
    html += '<div class="sidebar-section">';
    html += '<p class="section-title">General</p>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Title</span><input type="text" class="ctrl-text" id="edit-site-title" value="' + escAttr(config.designer.name) + '"></div>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Tagline</span><input type="text" class="ctrl-text" id="edit-site-tagline" value="' + escAttr(config.designer.tagline || '') + '"></div>';
    html += '<div class="ctrl-label" style="display:block;margin-top:10px;margin-bottom:6px">Site Logo</div>';
    html += logoFieldHTML(config.designer.logo, 'site-logo-input', 'btn-remove-site-logo');
    html += '</div>';

    // Hero typography
    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Hero</p>';
    html += styleSliderRow('Title size',  'heroTitleSize',     s.heroTitleSize    != null ? s.heroTitleSize    : 52, 16, 120, 1, 'px');
    html += styleWeightRow('Title weight','heroTitleWeight',   s.heroTitleWeight  != null ? s.heroTitleWeight  : 300);
    html += styleColorRow ('Title color', 'heroTitleColor',    '#111111');
    html += styleSliderRow('Sub size',    'heroSubtitleSize',  s.heroSubtitleSize != null ? s.heroSubtitleSize : 16, 10, 48,  1, 'px');
    html += styleColorRow ('Sub color',   'heroSubtitleColor', '#888888');
    html += styleSliderRow('Pad top',     'heroPaddingTop',    s.heroPaddingTop   != null ? s.heroPaddingTop   : 88, 0, 200, 4, 'px');
    html += styleSliderRow('Pad bottom',  'heroPaddingBottom', s.heroPaddingBottom!= null ? s.heroPaddingBottom: 64, 0, 200, 4, 'px');
    html += '</div>';

    // Home tiles
    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Home Tiles</p>';
    html += '<p style="font-size:11px;color:var(--muted);margin-bottom:0">Click a tile in the preview to select it.</p>';
    html += '</div>';

    if (selectedIndex >= 0 && config.clients[selectedIndex]) {
      var c    = config.clients[selectedIndex];
      var logoH = c.logoSize || 120;
      html += '<div class="sidebar-section">';
      html += '<p class="section-title">' + esc(c.name) + '</p>';
      html += tileSizeSelector(c.tileSize || 'featured');
      html += '<div class="ctrl-row" style="margin-top:14px"><span class="ctrl-label">Logo size</span>';
      html += '<input type="range" class="ctrl-slider" id="logo-size-slider" min="40" max="300" step="4" value="' + logoH + '">';
      html += '<input type="number" class="ctrl-num" id="logo-size-num" min="40" max="300" value="' + logoH + '">';
      html += '<span class="ctrl-unit">px</span></div>';
      html += '</div>';
    }

    $sidebar.innerHTML = html;
    bindHomeSidebarEvents();
  }

  function tileSizeSelector(current) {
    var sizes = ['normal', 'wide', 'large', 'featured', 'hero'];
    var html  = '<div class="ctrl-label" style="display:block;margin-bottom:6px">Tile size</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:5px">';
    sizes.forEach(function (s) {
      var a = current === s;
      html += '<button class="size-btn' + (a ? ' active' : '') + '" data-size="' + s + '" style="padding:4px 10px;border:1px solid ' + (a ? '#111' : '#ddd') + ';border-radius:3px;font-size:11px;background:' + (a ? '#111' : '#fff') + ';color:' + (a ? '#fff' : '#555') + ';cursor:pointer">' + s + '</button>';
    });
    html += '</div>';
    return html;
  }

  function bindHomeSidebarEvents() {
    var titleInput = document.getElementById('edit-site-title');
    if (titleInput) {
      titleInput.addEventListener('input', function () {
        config.designer.name = this.value;
        markDirty(); sendToPreview();
      });
    }

    var taglineInput = document.getElementById('edit-site-tagline');
    if (taglineInput) {
      taglineInput.addEventListener('input', function () {
        config.designer.tagline = this.value;
        markDirty(); sendToPreview();
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
          markDirty(); renderAll();
        });
      });
    }

    var removeSiteLogo = document.getElementById('btn-remove-site-logo');
    if (removeSiteLogo) {
      removeSiteLogo.addEventListener('click', function () {
        fetch('/api/logo/site', { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          delete config.designer.logo;
          markDirty(); renderAll();
        });
      });
    }

    bindStyleInputs();

    if (selectedIndex >= 0) {
      $sidebar.querySelectorAll('.size-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          config.clients[selectedIndex].tileSize = btn.dataset.size;
          markDirty();
          renderHomeSidebar();
          sendToPreview();
        });
      });

      var logoSlider = document.getElementById('logo-size-slider');
      var logoNum    = document.getElementById('logo-size-num');
      function updateLogoSize(val) {
        config.clients[selectedIndex].logoSize = parseInt(val, 10);
        markDirty();
        sendToPreview();
      }
      if (logoSlider) logoSlider.addEventListener('input', function () { logoNum.value = this.value; updateLogoSize(this.value); });
      if (logoNum)    logoNum.addEventListener('input',    function () { logoSlider.value = this.value; updateLogoSize(this.value); });
    }
  }

  // ── Project sidebar ───────────────────────────────────────────────────────
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
    var g      = resolvedG(client);
    var logoSrc = projectLogoSrc(client);
    var s       = config.designer.styles || {};

    // Project info
    var html = '<div class="sidebar-section">';
    html += '<p class="section-title">Project</p>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Name</span><input type="text" class="ctrl-text" id="edit-client-name" value="' + escAttr(client.name) + '"></div>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Category</span><input type="text" class="ctrl-text" id="edit-client-category" value="' + escAttr(client.category || '') + '"></div>';
    html += '<div class="ctrl-label" style="display:block;margin-top:10px;margin-bottom:6px">Logo</div>';
    html += logoFieldHTML(logoSrc, 'proj-logo-input', 'btn-remove-proj-logo');
    html += '<button class="btn-remove" id="btn-delete-client" style="margin-top:12px">Delete Project</button>';
    html += '</div>';

    // Page typography (global setting, shown here for project context)
    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Page Title</p>';
    html += styleSliderRow('Size',   'projectTitleSize',   s.projectTitleSize   != null ? s.projectTitleSize   : 28,  12, 80,  1, 'px');
    html += styleWeightRow('Weight', 'projectTitleWeight', s.projectTitleWeight != null ? s.projectTitleWeight : 300);
    html += styleColorRow ('Color',  'projectTitleColor',  '#111111');
    html += '</div>';

    // Grid settings
    var bpLabel = activeBP === 'desktop' ? '' : ' · ' + activeBP.charAt(0).toUpperCase() + activeBP.slice(1);
    html += '<div class="sidebar-section">';
    html += '<p class="section-title">Grid<span style="text-transform:none;font-weight:400;letter-spacing:0;opacity:0.6">' + bpLabel + '</span></p>';
    html += sliderRow('Columns',    'columns',       g.columns,       1, 8,   1, '');
    html += sliderRow('Row height', 'rowHeight',     g.rowHeight||0,  0, 800, 10,'px');
    html += sliderRow('Gutter',     'gap',           g.gap,           0, 60,  1, 'px');
    html += sliderRow('Width %',    'width',         g.width,         20,100, 1, '%');
    html += numRow   ('Max width',  'maxWidth',      g.maxWidth||0,       'px');
    html += sliderRow('Above',      'paddingTop',    g.paddingTop,    0, 200, 4, 'px');
    html += sliderRow('Below',      'paddingBottom', g.paddingBottom, 0, 200, 4, 'px');
    html += '</div>';

    // Selected asset
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

    // Add to grid
    var folder    = clientFolder(client);
    var folderKey = folder ? folder.replace('Assets/', '') : client.name;
    var allFiles  = availableFiles[folderKey] || [];
    var usedFiles = client.assets.map(function (a) { return a.file; });
    var unused    = allFiles.filter(function (f) { return usedFiles.indexOf(f) === -1; });

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
    bindStyleInputs();
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
    var nameInput = document.getElementById('edit-client-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        client.name = this.value; markDirty(); renderTabs();
      });
    }

    var catInput = document.getElementById('edit-client-category');
    if (catInput) {
      catInput.addEventListener('input', function () {
        client.category = this.value; markDirty(); sendToPreview();
      });
    }

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
          client.logo = data.logo; markDirty(); renderAll();
        });
      });
    }

    var removeProjLogo = document.getElementById('btn-remove-proj-logo');
    if (removeProjLogo) {
      removeProjLogo.addEventListener('click', function () {
        fetch('/api/logo/project/' + client.id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert(data.error); return; }
          delete client.logo; markDirty(); renderAll();
        });
      });
    }

    var deleteBtn = document.getElementById('btn-delete-client');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!confirm('Remove "' + client.name + '" from portfolio? (Assets folder is kept)')) return;
        var idx = config.clients.indexOf(client);
        if (idx >= 0) config.clients.splice(idx, 1);
        view = 'home'; selectedIndex = -1;
        fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        }).catch(function () {});
        dirty = false;
        renderAll();
      });
    }

    // Grid sliders (data-key, not data-skey)
    $sidebar.querySelectorAll('input[type="range"][data-key], input[type="number"][data-key]').forEach(function (el) {
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
            sendToPreview();
          }
          return;
        }
        if (key === 'asset-rows') {
          if (selectedIndex >= 0 && client.assets[selectedIndex]) {
            var rows = Math.max(1, Math.round(val));
            if (rows === 1) delete client.assets[selectedIndex].rows;
            else client.assets[selectedIndex].rows = rows;
            markDirty();
            $sidebar.querySelectorAll('[data-key="asset-rows"]').forEach(function (s) { s.value = rows; });
            sendToPreview();
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
        if (key === 'columns') { selectedIndex = -1; renderProjectSidebar(); }
        sendToPreview();
      });
    });

    var removeBtn = document.getElementById('btn-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (selectedIndex < 0) return;
        client.assets.splice(selectedIndex, 1);
        selectedIndex = -1;
        markDirty(); renderAll();
      });
    }

    var uploadInput = document.getElementById('upload-input');
    if (uploadInput) {
      uploadInput.addEventListener('change', function () {
        if (!this.files.length) return;
        var labelText = document.getElementById('upload-label-text');
        if (labelText) labelText.textContent = 'Uploading…';
        var fd = new FormData();
        Array.prototype.forEach.call(this.files, function (f) { fd.append('files', f); });
        fetch('/api/upload/' + client.id, { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { alert('Upload failed: ' + data.error); renderSidebar(); return; }
          return fetch('/api/assets').then(function (r) { return r.json(); }).then(function (files) {
            availableFiles = files; renderSidebar();
          });
        })
        .catch(function (ex) { alert('Upload error: ' + ex.message); renderSidebar(); });
      });
    }

    $sidebar.querySelectorAll('.avail-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var file = el.dataset.file;
        client.assets.push({ file: file, type: guessType(file) });
        markDirty(); renderAll();
      });
    });
  }

}());
