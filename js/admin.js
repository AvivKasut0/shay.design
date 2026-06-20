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
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  }

  var VP_ICONS = {
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    tablet:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 18h.01"/></svg>',
    mobile:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  var config         = null;
  var availableFiles = {};
  var view           = 'home';
  var selectedIndex  = -1;
  var dirty          = false;
  var activeBP       = 'desktop';
  var history        = [];
  var historyIndex   = -1;
  var historyTimer   = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var $tabs    = document.getElementById('admin-tabs');
  var $sidebar = document.getElementById('sidebar');
  var $frame   = document.getElementById('preview-frame');
  var $toolbar = document.getElementById('preview-toolbar');
  var $save    = document.getElementById('btn-save');
  var $viewBtn = document.getElementById('btn-view');

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
    $save.classList.remove('is-saved');
    debouncedPush();
  }

  function pushHistory() {
    clearTimeout(historyTimer); historyTimer = null;
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(config)));
    if (history.length > 60) history.splice(0, history.length - 60);
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

  function debouncedPush() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(pushHistory, 500);
  }

  function applyHistoryState() {
    config = JSON.parse(JSON.stringify(history[historyIndex]));
    if (view !== 'home' && !config.clients.find(function (c) { return c.id === view; })) {
      view = 'home'; selectedIndex = -1;
    }
    dirty = true;
    $save.textContent = 'Save';
    $save.classList.remove('is-saved');
    renderAll();
    updateUndoRedoButtons();
  }

  function undo() {
    clearTimeout(historyTimer); historyTimer = null;
    if (historyIndex <= 0) return;
    historyIndex--;
    applyHistoryState();
  }

  function redo() {
    clearTimeout(historyTimer); historyTimer = null;
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applyHistoryState();
  }

  function updateUndoRedoButtons() {
    var u = document.getElementById('btn-undo');
    var r = document.getElementById('btn-redo');
    if (u) u.disabled = historyIndex <= 0;
    if (r) r.disabled = historyIndex >= history.length - 1;
  }

  function setDeviceMode(active) {
    var el = document.getElementById('preview');
    if (active) el.classList.add('device-mode');
    else        el.classList.remove('device-mode');
  }

  // Mirrors gridStyle() in main.js — compute CSS style string for the asset grid
  function computeGridStyle(g) {
    var parts = [
      'display:grid',
      'grid-template-columns:repeat(' + g.columns + ',1fr)',
      'gap:' + g.gap + 'px',
      'width:' + g.width + '%',
      'padding-top:' + g.paddingTop + 'px',
      'padding-bottom:' + g.paddingBottom + 'px',
      'margin:0 auto',
      g.rowHeight ? 'align-items:stretch' : 'align-items:start',
    ];
    if (g.maxWidth)  parts.push('max-width:' + g.maxWidth + 'px');
    if (g.rowHeight) parts.push('grid-auto-rows:' + g.rowHeight + 'px');
    return parts.join(';');
  }

  // ── Messaging ─────────────────────────────────────────────────────────────
  // Targeted send — posts a single surgical update, no re-render in iframe
  function sendMsg(data) {
    if (!$frame || !$frame.contentWindow) return;
    try { $frame.contentWindow.postMessage(data, '*'); } catch (e) {}
  }

  // Full re-render — only for structural changes: navigation, add/remove, logo upload
  function sendToPreview() {
    sendMsg({
      type:   'preview-update',
      config: config,
      route:  view === 'home' ? '' : 'client/' + view,
      bp:     activeBP,
    });
  }

  function applyViewport() {
    var isDevice = activeBP !== 'desktop';
    setDeviceMode(isDevice);
    if (activeBP === 'mobile')      $frame.style.maxWidth = '390px';
    else if (activeBP === 'tablet') $frame.style.maxWidth = '768px';
    else                            $frame.style.maxWidth = '';
  }

  $frame.addEventListener('load', function () {
    try { $frame.contentWindow.postMessage({ type: 'theme-change', theme: document.documentElement.getAttribute('data-theme') }, '*'); } catch (e) {}
    if (config) sendToPreview();
  });

  // ── Bidirectional messages from iframe ────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var msg = e.data;

    if (msg.type === 'tile-click' && view === 'home') {
      selectedIndex = msg.index;
      renderSidebar();
      sendMsg({ type: 'preview-select', page: 'tile', index: selectedIndex });
      return;
    }

    if (msg.type === 'asset-click' && view !== 'home') {
      selectedIndex = msg.index;
      renderSidebar();
      var clickedClient = currentClient();
      var clickedAsset  = clickedClient && clickedClient.assets[selectedIndex];
      sendMsg({ type: 'preview-select', page: 'asset', index: selectedIndex,
                cols: clickedAsset ? (clickedAsset.cols || 1) : 1,
                rows: clickedAsset ? (clickedAsset.rows || 1) : 1 });
      return;
    }

    if (msg.type === 'asset-drop') {
      var client = currentClient();
      if (!client) return;
      var moved = client.assets.splice(msg.from, 1)[0];
      client.assets.splice(msg.to, 0, moved);
      if      (selectedIndex === msg.from)                          selectedIndex = msg.to;
      else if (selectedIndex > msg.from && selectedIndex <= msg.to) selectedIndex--;
      else if (selectedIndex < msg.from && selectedIndex >= msg.to) selectedIndex++;
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

    if (msg.type === 'asset-span-delta') {
      var spanClient = currentClient();
      if (!spanClient || msg.index < 0 || !spanClient.assets[msg.index]) return;
      var spanAsset = spanClient.assets[msg.index];
      var spanG     = resolvedG(spanClient);
      var newCols   = Math.max(1, Math.min(spanG.columns, (spanAsset.cols || 1) + (msg.colDelta || 0)));
      var newRows   = Math.max(1, Math.min(6,             (spanAsset.rows || 1) + (msg.rowDelta || 0)));
      if (newCols === 1) delete spanAsset.cols; else spanAsset.cols = newCols;
      if (newRows === 1) delete spanAsset.rows; else spanAsset.rows = newRows;
      markDirty();
      renderSidebar();
      sendMsg({ type: 'asset-span-update', assetIndex: msg.index, cols: newCols, rows: newRows, totalCols: spanG.columns });
      sendMsg({ type: 'preview-select', page: 'asset', index: msg.index, cols: newCols, rows: newRows });
      return;
    }

    if (msg.type === 'asset-remove') {
      var removeClient = currentClient();
      if (!removeClient || msg.index < 0) return;
      removeClient.assets.splice(msg.index, 1);
      selectedIndex = -1;
      markDirty();
      renderAll();
      return;
    }

    if (msg.type === 'asset-deselect') {
      selectedIndex = -1;
      renderSidebar();
      sendMsg({ type: 'preview-select', page: 'asset', index: -1 });
      return;
    }
  });

  // ── Theme toggle ──────────────────────────────────────────────────────────
  (function () {
    var btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.innerHTML = themeIcon();
    document.getElementById('admin-actions').prepend(btn);
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      var rect = btn.getBoundingClientRect();
      document.documentElement.style.setProperty('--vt-x', Math.round(rect.left + rect.width  / 2) + 'px');
      document.documentElement.style.setProperty('--vt-y', Math.round(rect.top  + rect.height / 2) + 'px');
      function doSwitch() {
        document.documentElement.setAttribute('data-theme', next);
        if (next === 'dark') document.documentElement.classList.add('dark');
        else                 document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', next);
        btn.innerHTML = themeIcon();
        sendMsg({ type: 'theme-change', theme: next });
      }
      if (document.startViewTransition) document.startViewTransition(doSwitch);
      else doSwitch();
    });
  })();

  // ── Undo / Redo buttons ────────────────────────────────────────────────────
  (function () {
    var UNDO_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
    var REDO_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';
    var actions = document.getElementById('admin-actions');

    var redoBtn = document.createElement('button');
    redoBtn.id = 'btn-redo';
    redoBtn.className = 'icon-btn';
    redoBtn.title = 'Redo (Ctrl+Y)';
    redoBtn.setAttribute('aria-label', 'Redo');
    redoBtn.innerHTML = REDO_ICON;
    redoBtn.disabled = true;
    redoBtn.addEventListener('click', redo);
    actions.insertBefore(redoBtn, $viewBtn);

    var undoBtn = document.createElement('button');
    undoBtn.id = 'btn-undo';
    undoBtn.className = 'icon-btn';
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.setAttribute('aria-label', 'Undo');
    undoBtn.innerHTML = UNDO_ICON;
    undoBtn.disabled = true;
    undoBtn.addEventListener('click', undo);
    actions.insertBefore(undoBtn, redoBtn);
  })();

  // ── Init ──────────────────────────────────────────────────────────────────
  Promise.all([
    fetch('/api/config').then(function (r) { return r.json(); }),
    fetch('/api/assets').then(function (r) { return r.json(); }),
  ]).then(function (results) {
    config         = results[0];
    availableFiles = results[1];
    pushHistory();
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
      $save.classList.add('is-saved');
      setTimeout(function () {
        if (!dirty) { $save.textContent = 'Save'; $save.classList.remove('is-saved'); }
      }, 2500);
    })
    .catch(function () { $save.textContent = 'Error — try again'; });
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); $save.click(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });

  // ── Render all (structural change) ───────────────────────────────────────
  function renderAll() {
    renderTabs();
    renderToolbar();
    renderSidebar();
    sendToPreview();
    applyViewport();
    if ($viewBtn) $viewBtn.href = view === 'home' ? '/' : '/#client/' + view;
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
        renderSidebar();
        applyViewport();
        if (view !== 'home') sendToPreview();
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

  // ── Sidebar dispatch ──────────────────────────────────────────────────────
  function renderSidebar() {
    if (view === 'home') renderHomeSidebar();
    else                 renderProjectSidebar();
  }

  // ── Logo field HTML ───────────────────────────────────────────────────────
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

  // ── Style control row builders ────────────────────────────────────────────
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

  // Bind style inputs — sends targeted styles-update (no page re-render, no blink)
  function bindStyleInputs() {
    function dispatchStyles() {
      sendMsg({ type: 'styles-update', styles: config.designer.styles || {} });
    }

    $sidebar.querySelectorAll('input[type="range"][data-skey], input[type="number"][data-skey]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.skey;
        var val = parseFloat(el.value);
        if (!config.designer.styles) config.designer.styles = {};
        config.designer.styles[key] = val;
        markDirty();
        $sidebar.querySelectorAll('[data-skey="' + key + '"]').forEach(function (s) {
          if (s !== el && s.tagName === 'INPUT') s.value = val;
        });
        dispatchStyles();
      });
    });

    $sidebar.querySelectorAll('input[type="color"][data-skey]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.skey;
        if (!config.designer.styles) config.designer.styles = {};
        config.designer.styles[key] = this.value;
        var autoBtn = $sidebar.querySelector('.btn-auto[data-skey="' + key + '"]');
        if (autoBtn) { autoBtn.classList.remove('is-auto'); autoBtn.textContent = '✕'; autoBtn.title = 'Reset to auto'; }
        markDirty();
        dispatchStyles();
      });
    });

    $sidebar.querySelectorAll('.btn-auto[data-skey]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.dataset.skey;
        if (config.designer.styles) delete config.designer.styles[key];
        el.classList.add('is-auto');
        el.textContent = 'auto';
        el.title = 'Auto — follows theme';
        markDirty();
        dispatchStyles();
      });
    });

    $sidebar.querySelectorAll('select[data-skey]').forEach(function (el) {
      el.addEventListener('change', function () {
        var key = el.dataset.skey;
        if (!config.designer.styles) config.designer.styles = {};
        config.designer.styles[key] = parseInt(this.value, 10);
        markDirty();
        dispatchStyles();
      });
    });
  }

  // ── Home sidebar ──────────────────────────────────────────────────────────
  function renderHomeSidebar() {
    var s = config.designer.styles || {};

    // Preserve collapse states across re-renders
    var ss = {};
    $sidebar.querySelectorAll('details[data-key]').forEach(function (d) { ss[d.dataset.key] = d.open; });
    function sOpen(key, def) { return (ss[key] !== undefined ? ss[key] : (def !== false)) ? ' open' : ''; }

    var html = '';

    html += '<details class="sidebar-section" data-key="general"' + sOpen('general') + '>';
    html += '<summary class="section-title">General</summary>';
    html += '<div class="section-body">';
    html += '<div class="ctrl-row"><span class="ctrl-label">Title</span><input type="text" class="ctrl-text" id="edit-site-title" value="' + escAttr(config.designer.name) + '"></div>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Tagline</span><input type="text" class="ctrl-text" id="edit-site-tagline" value="' + escAttr(config.designer.tagline || '') + '"></div>';
    html += '<div class="ctrl-label" style="display:block;margin-top:10px;margin-bottom:6px">Site Logo</div>';
    html += logoFieldHTML(config.designer.logo, 'site-logo-input', 'btn-remove-site-logo');
    html += '</div></details>';

    html += '<details class="sidebar-section" data-key="hero"' + sOpen('hero') + '>';
    html += '<summary class="section-title">Hero</summary>';
    html += '<div class="section-body">';
    html += styleSliderRow('Title size',  'heroTitleSize',     s.heroTitleSize     != null ? s.heroTitleSize     : 52, 12, 120, 1, 'px');
    html += styleWeightRow('Title weight','heroTitleWeight',   s.heroTitleWeight   != null ? s.heroTitleWeight   : 300);
    html += styleColorRow ('Title color', 'heroTitleColor',    '#111111');
    html += styleSliderRow('Sub size',    'heroSubtitleSize',  s.heroSubtitleSize  != null ? s.heroSubtitleSize  : 16, 8, 48,  1, 'px');
    html += styleColorRow ('Sub color',   'heroSubtitleColor', '#888888');
    html += styleSliderRow('Pad top',     'heroPaddingTop',    s.heroPaddingTop    != null ? s.heroPaddingTop    : 88, 0, 200, 4, 'px');
    html += styleSliderRow('Pad bottom',  'heroPaddingBottom', s.heroPaddingBottom != null ? s.heroPaddingBottom : 64, 0, 200, 4, 'px');
    html += '</div></details>';

    html += '<details class="sidebar-section" data-key="home-tiles"' + sOpen('home-tiles') + '>';
    html += '<summary class="section-title">Home Tiles</summary>';
    html += '<div class="section-body">';
    html += '<p style="font-size:11px;color:#a1a1aa;margin-bottom:0">Click a tile in the preview to select it.</p>';
    html += '</div></details>';

    if (selectedIndex >= 0 && config.clients[selectedIndex]) {
      var c = config.clients[selectedIndex];
      var logoH = c.logoSize || 120;
      html += '<details class="sidebar-section" data-key="selected-tile"' + sOpen('selected-tile') + '>';
      html += '<summary class="section-title">' + esc(c.name) + '</summary>';
      html += '<div class="section-body">';
      html += tileSizeSelector(c.tileSize || 'featured');
      html += '<div class="ctrl-row" style="margin-top:14px"><span class="ctrl-label">Logo size</span>';
      html += '<input type="range"  class="ctrl-slider" id="logo-size-slider" min="20" max="500" step="8" value="' + logoH + '">';
      html += '<input type="number" class="ctrl-num"    id="logo-size-num"    min="20" max="500"          value="' + logoH + '">';
      html += '<span class="ctrl-unit">px</span></div>';
      html += '</div></details>';
    }

    $sidebar.innerHTML = html;
    bindHomeSidebarEvents();
  }

  function tileSizeSelector(current) {
    var sizes = ['normal', 'wide', 'large', 'featured', 'hero'];
    var html  = '<div class="ctrl-label" style="display:block;margin-bottom:8px">Tile size</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:5px">';
    sizes.forEach(function (s) {
      html += '<button class="size-btn' + (current === s ? ' active' : '') + '" data-size="' + s + '">' + s + '</button>';
    });
    html += '</div>';
    return html;
  }

  function bindHomeSidebarEvents() {
    var titleInput = document.getElementById('edit-site-title');
    if (titleInput) {
      titleInput.addEventListener('input', function () {
        config.designer.name = this.value;
        markDirty();
        sendMsg({ type: 'hero-text-update', name: config.designer.name, tagline: config.designer.tagline || '', logo: config.designer.logo || null });
      });
    }

    var taglineInput = document.getElementById('edit-site-tagline');
    if (taglineInput) {
      taglineInput.addEventListener('input', function () {
        config.designer.tagline = this.value;
        markDirty();
        sendMsg({ type: 'hero-text-update', name: config.designer.name, tagline: config.designer.tagline || '', logo: config.designer.logo || null });
      });
    }

    var siteLogoInput = document.getElementById('site-logo-input');
    if (siteLogoInput) {
      siteLogoInput.addEventListener('change', function () {
        if (!this.files[0]) return;
        var fd = new FormData(); fd.append('logo', this.files[0]);
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
          sendMsg({ type: 'tile-attr-update', clientIndex: selectedIndex, tileSize: btn.dataset.size });
        });
      });

      var logoSlider = document.getElementById('logo-size-slider');
      var logoNum    = document.getElementById('logo-size-num');

      function updateLogoSize(val) {
        config.clients[selectedIndex].logoSize = parseInt(val, 10);
        markDirty();
        sendMsg({ type: 'logo-size-update', clientIndex: selectedIndex, size: parseInt(val, 10) });
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
    var g       = resolvedG(client);
    var logoSrc = projectLogoSrc(client);
    var s       = config.designer.styles || {};

    // Preserve collapse states across re-renders (sections + inner advanced toggle)
    var ss = {};
    $sidebar.querySelectorAll('details[data-key]').forEach(function (d) { ss[d.dataset.key] = d.open; });
    function sOpen(key, def) { return (ss[key] !== undefined ? ss[key] : (def !== false)) ? ' open' : ''; }

    var bpLabel = ' · ' + activeBP.charAt(0).toUpperCase() + activeBP.slice(1);
    var html = '';

    // 1 — Grid
    html += '<details class="sidebar-section" data-key="grid"' + sOpen('grid') + '>';
    html += '<summary class="section-title">Grid<span style="text-transform:none;font-weight:400;letter-spacing:0;opacity:0.6">' + bpLabel + '</span></summary>';
    html += '<div class="section-body">';
    html += columnPickerRow(g.columns);
    html += sliderRow('Row height', 'rowHeight',     g.rowHeight || 0, 0, 800, 10, 'px');
    html += sliderRow('Gutter',     'gap',           g.gap,            0, 60,  1,  'px');
    html += sliderRow('Width %',    'width',         g.width,          20, 100, 1,  '%');
    html += numRow   ('Max width',  'maxWidth',      g.maxWidth || 0,       'px');
    html += sliderRow('Above',      'paddingTop',    g.paddingTop,     0,  200, 4,  'px');
    html += sliderRow('Below',      'paddingBottom', g.paddingBottom,  0,  200, 4,  'px');
    html += '</div></details>';

    // 2 — Selected Image (thumbnail + remove only; col/row controls live on the tile strip)
    if (selectedIndex >= 0 && client.assets[selectedIndex]) {
      var asset = client.assets[selectedIndex];
      html += '<details class="sidebar-section" data-key="selected-img"' + sOpen('selected-img') + '>';
      html += '<summary class="section-title">Selected Image</summary>';
      html += '<div class="section-body">';
      html += '<img class="selected-thumb" src="' + escAttr(asset.file) + '" onerror="this.style.display=\'none\'">';
      html += '<button class="btn-remove" id="btn-remove">Remove from grid</button>';
      html += '</div></details>';
    }

    // 3 — Add to Grid
    var folder    = clientFolder(client);
    var folderKey = folder ? folder.replace('Assets/', '') : client.name;
    var allFiles  = availableFiles[folderKey] || [];
    var usedFiles = client.assets.map(function (a) { return a.file; });
    var unused    = allFiles.filter(function (f) { return usedFiles.indexOf(f) === -1; });

    html += '<details class="sidebar-section" data-key="add-grid"' + sOpen('add-grid') + '>';
    html += '<summary class="section-title">Add to Grid</summary>';
    html += '<div class="section-body">';
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
    html += '</div></details>';

    // 4 — Page Title
    html += '<details class="sidebar-section" data-key="page-title"' + sOpen('page-title') + '>';
    html += '<summary class="section-title">Page Title</summary>';
    html += '<div class="section-body">';
    html += styleSliderRow('Size',   'projectTitleSize',   s.projectTitleSize   != null ? s.projectTitleSize   : 28, 12, 80, 1, 'px');
    html += styleWeightRow('Weight', 'projectTitleWeight', s.projectTitleWeight != null ? s.projectTitleWeight : 300);
    html += styleColorRow ('Color',  'projectTitleColor',  '#111111');
    html += '</div></details>';

    // 5 — Project (name/category/logo/delete — structural, rarely changed, collapsed by default)
    html += '<details class="sidebar-section" data-key="project"' + sOpen('project', false) + '>';
    html += '<summary class="section-title">Project</summary>';
    html += '<div class="section-body">';
    html += '<div class="ctrl-row"><span class="ctrl-label">Name</span><input type="text" class="ctrl-text" id="edit-client-name" value="' + escAttr(client.name) + '"></div>';
    html += '<div class="ctrl-row"><span class="ctrl-label">Category</span><input type="text" class="ctrl-text" id="edit-client-category" value="' + escAttr(client.category || '') + '"></div>';
    html += '<div class="ctrl-label" style="display:block;margin-top:10px;margin-bottom:6px">Logo</div>';
    html += logoFieldHTML(logoSrc, 'proj-logo-input', 'btn-remove-proj-logo');
    html += '<button class="btn-remove" id="btn-delete-client" style="margin-top:12px">Delete Project</button>';
    html += '</div></details>';

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

  function columnPickerRow(currentCols) {
    var html = '<div class="ctrl-row col-picker-row"><span class="ctrl-label">Columns</span><div class="col-picker">';
    for (var n = 1; n <= 8; n++) {
      var bars = '';
      for (var b = 0; b < n; b++) {
        var x = (b * 20 / n).toFixed(1);
        var w = Math.max(1, 20 / n - 1.5).toFixed(1);
        bars += '<rect x="' + x + '" y="0" width="' + w + '" height="12"/>';
      }
      var svg = '<svg width="20" height="12" viewBox="0 0 20 12" fill="currentColor">' + bars + '</svg>';
      html += '<button class="col-picker-btn' + (currentCols === n ? ' active' : '') + '" data-cols="' + n + '" title="' + n + (n === 1 ? ' column' : ' columns') + '">' + svg + '<span class="col-picker-num">' + n + '</span></button>';
    }
    html += '</div></div>';
    return html;
  }

  function bindProjectSidebarEvents(client, g) {
    var nameInput = document.getElementById('edit-client-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        client.name = this.value;
        markDirty();
        renderTabs();
        sendMsg({ type: 'project-text-update', name: client.name, category: client.category || '' });
      });
    }

    var catInput = document.getElementById('edit-client-category');
    if (catInput) {
      catInput.addEventListener('input', function () {
        client.category = this.value;
        markDirty();
        sendMsg({ type: 'project-text-update', name: client.name, category: client.category || '' });
      });
    }

    var projLogoInput = document.getElementById('proj-logo-input');
    if (projLogoInput) {
      projLogoInput.addEventListener('change', function () {
        if (!this.files[0]) return;
        var fd = new FormData(); fd.append('logo', this.files[0]);
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

    $sidebar.querySelectorAll('.col-picker-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cols = parseInt(btn.dataset.cols, 10);
        if (!client.grid) client.grid = {};
        if (activeBP === 'desktop') {
          client.grid.columns = cols;
        } else {
          if (!client.grid[activeBP]) client.grid[activeBP] = {};
          client.grid[activeBP].columns = cols;
        }
        markDirty();
        selectedIndex = -1;
        renderProjectSidebar();
        sendToPreview();
      });
    });

    $sidebar.querySelectorAll('input[type="range"][data-key], input[type="number"][data-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.key;
        var val = parseFloat(el.value);

        if (!client.grid) client.grid = {};
        if (activeBP === 'desktop') {
          client.grid[key] = val;
        } else {
          if (!client.grid[activeBP]) client.grid[activeBP] = {};
          client.grid[activeBP][key] = val;
        }
        markDirty();
        $sidebar.querySelectorAll('[data-key="' + key + '"]').forEach(function (s) { s.value = val; });

        // All grid props (except columns, now handled by picker): targeted update, no blink
        var newG = resolvedG(client);
        sendMsg({ type: 'grid-style-update', style: computeGridStyle(newG) });
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
