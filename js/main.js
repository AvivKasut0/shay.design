(function () {
  'use strict';

  var IS_PREVIEW    = /[?&]preview=1/.test(location.search);
  var CONFIG        = null;
  var _previewRoute = '';
  var _previewBP    = 'desktop'; // breakpoint set by admin, used instead of window.innerWidth in preview

  // ── Social icon SVGs ─────────────────────────────────────────────────────
  var SOCIAL_ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></svg>',
    linkedin:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
    behance:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 1.202.58 1.662 1.573 1.662.671 0 1.148-.238 1.368-.607H23v.974zM15.998 13h3.796c-.104-1.196-.71-1.81-1.86-1.81-1.12 0-1.797.628-1.936 1.81zM8.221 11.717c1.492-.326 2.145-1.3 2.145-2.655 0-2.078-1.567-3.062-3.516-3.062H2v12h4.857c2.2 0 4.07-1.08 4.07-3.378 0-1.494-.667-2.595-2.706-2.905zM5.5 8.5H7c.667 0 1.2.3 1.2 1 0 .7-.567 1-1.2 1H5.5V8.5zm1.667 6H5.5v-2.25h1.667C8 12.25 8.5 12.75 8.5 13.5s-.5 1-1.333 1z"/></svg>',
  };

  // ── Refs ─────────────────────────────────────────────────────────────────
  var app;
  var lbAssets = [];
  var lbPos    = 0;

  // ── Utilities ─────────────────────────────────────────────────────────────
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mediaHTML(asset, inLightbox) {
    if (asset.type === 'video') {
      var attrs = inLightbox ? 'controls' : 'autoplay muted loop playsinline';
      return '<video src="' + escAttr(asset.file) + '" ' + attrs + ' preload="none"></video>';
    }
    var loading = inLightbox ? '' : ' loading="lazy"';
    return '<img src="' + escAttr(asset.file) + '" alt="' + escAttr(asset.name || '') + '"' + loading + '>';
  }

  // ── Breakpoint detection ─────────────────────────────────────────────────
  function getBreakpoint() {
    return window.innerWidth <= 640 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop';
  }

  // ── Resolve grid config for current breakpoint ───────────────────────────
  function resolveGrid(rawGrid) {
    var g = rawGrid || {};
    var base = {
      columns:       g.columns       != null ? g.columns       : 3,
      gap:           g.gap           != null ? g.gap           : 10,
      width:         g.width         != null ? g.width         : 100,
      maxWidth:      g.maxWidth      != null ? g.maxWidth      : 0,
      paddingTop:    g.paddingTop    != null ? g.paddingTop    : 40,
      paddingBottom: g.paddingBottom != null ? g.paddingBottom : 0,
      rowHeight:     g.rowHeight     != null ? g.rowHeight     : 0,
    };
    // In preview mode, use the breakpoint the admin has selected rather than the
    // actual iframe window width (which can be narrower than 1024px even in "Desktop" mode).
    var bp = IS_PREVIEW ? _previewBP : getBreakpoint();
    if (bp !== 'desktop' && g[bp]) return Object.assign({}, base, g[bp]);
    return base;
  }

  // ── Grid inline style ────────────────────────────────────────────────────
  function gridStyle(g) {
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

  // ── Apply designer styles as CSS custom properties ────────────────────────
  function applyStylesObj(s) {
    var r = document.documentElement;
    function set(prop, val, suffix) {
      if (val != null) r.style.setProperty(prop, val + (suffix || ''));
      else             r.style.removeProperty(prop);
    }
    set('--hero-title-size',     s.heroTitleSize,     'px');
    set('--hero-title-weight',   s.heroTitleWeight != null ? String(s.heroTitleWeight) : null, '');
    set('--hero-title-color',    s.heroTitleColor,    '');
    set('--hero-subtitle-size',  s.heroSubtitleSize,  'px');
    set('--hero-subtitle-color', s.heroSubtitleColor, '');
    set('--hero-pt',             s.heroPaddingTop,    'px');
    set('--hero-pb',             s.heroPaddingBottom, 'px');
    set('--proj-title-size',     s.projectTitleSize,  'px');
    set('--proj-title-weight',   s.projectTitleWeight != null ? String(s.projectTitleWeight) : null, '');
    set('--proj-title-color',    s.projectTitleColor, '');
  }

  function applyDesignerStyles() {
    if (!CONFIG) return;
    applyStylesObj(CONFIG.designer.styles || {});
  }

  // ── Persistent page info ─────────────────────────────────────────────────
  function renderPageInfo() {
    var d = CONFIG.designer;
    document.title = d.name;

    var navLogo = document.getElementById('nav-logo');
    if (d.logo) {
      navLogo.innerHTML = '<img src="' + escAttr(d.logo) + '" alt="' + escAttr(d.name) + '" class="nav-logo-img">';
    } else {
      navLogo.textContent = d.name;
    }

    document.getElementById('footer-name').textContent = d.name;

    var links = '';
    Object.keys(d.social || {}).forEach(function (key) {
      var url = d.social[key];
      if (url && SOCIAL_ICONS[key]) {
        links += '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + key + '" class="social-link">' + SOCIAL_ICONS[key] + '</a>';
      }
    });
    document.getElementById('footer-social').innerHTML = links;

    var emailEl = document.getElementById('footer-email');
    if (d.email) {
      emailEl.innerHTML = '<a href="mailto:' + escAttr(d.email) + '">' + esc(d.email) + '</a>';
      emailEl.style.display = '';
    } else {
      emailEl.style.display = 'none';
    }
  }

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  function setBreadcrumb(label) {
    var el = document.getElementById('nav-breadcrumb');
    if (label) { el.textContent = '/ ' + label; el.classList.add('visible'); }
    else        { el.textContent = '';            el.classList.remove('visible'); }
  }

  // ── Logo path helper ──────────────────────────────────────────────────────
  function clientLogoPath(client) {
    if (client.logo) return client.logo;
    var first = client.assets[0] && client.assets[0].file;
    if (!first) return '';
    return first.substring(0, first.lastIndexOf('/')) + '/logo.png';
  }

  // ── HOME PAGE ─────────────────────────────────────────────────────────────
  function renderHome() {
    setBreadcrumb('');

    var tiles = CONFIG.clients.map(function (client) {
      var logo     = clientLogoPath(client);
      var logoDark = client.logoDark || null;
      var size     = client.tileSize || 'featured';
      var count    = client.assets.length;
      var countTxt = count + (count === 1 ? ' piece' : ' pieces');
      var logoH    = client.logoSize || 120;
      var imgStyle = ' style="max-height:' + logoH + 'px"';
      var imgErr   = ' onerror="this.style.display=\'none\'"';
      var logoHtml = '';
      if (logo && logoDark) {
        logoHtml =
          '<img src="' + escAttr(logo) + '" alt="' + escAttr(client.name) + '" class="logo-light" loading="lazy"' + imgStyle + imgErr + '>' +
          '<img src="' + escAttr(logoDark) + '" alt="' + escAttr(client.name) + '" class="logo-dark" loading="lazy"' + imgStyle + imgErr + '>';
      } else if (logo) {
        logoHtml = '<img src="' + escAttr(logo) + '" alt="' + escAttr(client.name) + '" loading="lazy"' + imgStyle + imgErr + '>';
      }

      return (
        '<a href="#client/' + escAttr(client.id) + '" class="bento-item client-tile" data-size="' + size + '">' +
          logoHtml +
          '<div class="tile-info">' +
            '<span class="tile-name">' + esc(client.name) + '</span>' +
            '<span class="tile-count">' + esc(countTxt) + '</span>' +
          '</div>' +
        '</a>'
      );
    }).join('');

    app.innerHTML = (
      '<header class="hero page-enter">' +
        '<h1>' + esc(CONFIG.designer.name) + '</h1>' +
        '<p>'  + esc(CONFIG.designer.tagline || '') + '</p>' +
      '</header>' +
      '<section class="page-section">' +
        '<div class="container">' +
          '<div class="bento bento-home page-enter">' + tiles + '</div>' +
        '</div>' +
      '</section>'
    );

    if (IS_PREVIEW) {
      // Intercept tile clicks — notify parent instead of navigating
      app.querySelectorAll('.client-tile').forEach(function (el, i) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          window.parent.postMessage({ type: 'tile-click', index: i }, '*');
        });
      });
    }
  }

  // ── CLIENT PAGE ───────────────────────────────────────────────────────────
  function renderClient(clientId) {
    var client = CONFIG.clients.find(function (c) { return c.id === clientId; });
    if (!client) { renderHome(); return; }

    setBreadcrumb(client.name);
    lbAssets = client.assets;

    var g     = resolveGrid(client.grid);
    var style = gridStyle(g);

    var items = client.assets.map(function (asset, i) {
      var clampedCols = Math.min(asset.cols || 1, g.columns);
      var colSpan     = clampedCols > 1 ? 'grid-column:span ' + clampedCols : '';
      var rowSpan     = asset.rows > 1  ? 'grid-row:span '    + asset.rows  : '';
      var spanCSS     = [colSpan, rowSpan].filter(Boolean).join(';');
      var styleAttr   = spanCSS ? ' style="' + spanCSS + '"' : '';
      var rowsAttr    = asset.rows > 1 ? ' data-rows="' + asset.rows + '"' : '';
      var draggable   = IS_PREVIEW ? ' draggable="true"' : '';
      return (
        '<div class="asset-tile"' + styleAttr + rowsAttr + draggable + ' data-index="' + i + '">' +
          mediaHTML({ file: asset.file, type: asset.type, name: client.name }, false) +
        '</div>'
      );
    }).join('');

    app.innerHTML = (
      '<section class="page-section client-page">' +
        '<div class="container">' +
          '<div class="client-page-header page-enter">' +
            '<a href="#" class="back-btn">&#8592; All Work</a>' +
            '<div>' +
              '<h2 class="client-page-title">' + esc(client.name) + '</h2>' +
              (client.category ? '<span class="client-page-category">' + esc(client.category) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="asset-grid page-enter" id="asset-grid" style="' + style + '">' + items + '</div>' +
        '</div>' +
      '</section>'
    );

    var grid = document.getElementById('asset-grid');

    if (IS_PREVIEW) {
      // Click → select asset, or deselect on empty area (no lightbox in preview)
      grid.addEventListener('click', function (e) {
        if (e.target.closest('.asset-ctrl-strip')) return;
        var tile = e.target.closest('.asset-tile');
        if (tile) {
          window.parent.postMessage({ type: 'asset-click', index: parseInt(tile.dataset.index, 10) }, '*');
        } else {
          window.parent.postMessage({ type: 'asset-deselect' }, '*');
        }
      });

      // Back button → tell parent to show home
      var backBtn = app.querySelector('.back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', function (e) {
          e.preventDefault();
          window.parent.postMessage({ type: 'navigate-home' }, '*');
        });
      }

      // Drag-to-reorder
      var dragSrcIndex = -1;
      grid.addEventListener('dragstart', function (e) {
        var tile = e.target.closest('.asset-tile');
        if (!tile) return;
        dragSrcIndex = parseInt(tile.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        tile.style.opacity = '0.4';
      });
      grid.addEventListener('dragend', function (e) {
        var tile = e.target.closest('.asset-tile');
        if (tile) tile.style.opacity = '';
        grid.querySelectorAll('.drag-over-preview').forEach(function (el) { el.classList.remove('drag-over-preview'); });
      });
      grid.addEventListener('dragover', function (e) {
        e.preventDefault();
        var tile = e.target.closest('.asset-tile');
        grid.querySelectorAll('.drag-over-preview').forEach(function (el) { el.classList.remove('drag-over-preview'); });
        if (tile && parseInt(tile.dataset.index, 10) !== dragSrcIndex) tile.classList.add('drag-over-preview');
      });
      grid.addEventListener('drop', function (e) {
        e.preventDefault();
        var tile = e.target.closest('.asset-tile');
        if (!tile) return;
        var dest = parseInt(tile.dataset.index, 10);
        if (dragSrcIndex === dest) return;
        window.parent.postMessage({ type: 'asset-drop', from: dragSrcIndex, to: dest }, '*');
      });

    } else {
      // Live site: click opens lightbox
      grid.addEventListener('click', function (e) {
        var tile = e.target.closest('.asset-tile');
        if (!tile) return;
        openLightbox(parseInt(tile.dataset.index, 10));
      });
    }
  }

  // ── Route helper (without scroll) ─────────────────────────────────────────
  function renderByRoute(r) {
    if (r.startsWith('client/')) renderClient(r.slice(7));
    else renderHome();
  }

  // ── LIGHTBOX ──────────────────────────────────────────────────────────────
  var lb = {};

  function initLightbox() {
    lb.el      = document.getElementById('lightbox');
    lb.media   = document.getElementById('lightbox-media');
    lb.label   = document.getElementById('lightbox-label');
    lb.counter = document.getElementById('lightbox-counter');
    lb.prev    = document.getElementById('lightbox-prev');
    lb.next    = document.getElementById('lightbox-next');

    lb.el.addEventListener('click', function (e) { if (e.target === lb.el) closeLightbox(); });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    lb.prev.addEventListener('click', function () { navigate(-1); });
    lb.next.addEventListener('click', function () { navigate(1); });

    document.addEventListener('keydown', function (e) {
      if (!lb.el.classList.contains('active')) return;
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });

    var touchStartX = 0;
    lb.el.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    lb.el.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function openLightbox(index) {
    lbPos = index;
    renderLightboxItem();
    lb.el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lb.el.classList.remove('active');
    document.body.style.overflow = '';
    lb.media.innerHTML = '';
  }

  function navigate(dir) {
    var next = lbPos + dir;
    if (next < 0 || next >= lbAssets.length) return;
    lbPos = next;
    renderLightboxItem();
  }

  function renderLightboxItem() {
    var asset = lbAssets[lbPos];
    lb.media.innerHTML = mediaHTML({ file: asset.file, type: asset.type }, true);
    var clientName = '';
    CONFIG.clients.forEach(function (c) {
      c.assets.forEach(function (a) { if (a.file === asset.file) clientName = c.name; });
    });
    lb.label.textContent   = clientName;
    lb.counter.textContent = (lbPos + 1) + ' / ' + lbAssets.length;
    lb.prev.style.visibility = lbPos === 0                   ? 'hidden' : '';
    lb.next.style.visibility = lbPos === lbAssets.length - 1 ? 'hidden' : '';
  }

  // ── ROUTER ────────────────────────────────────────────────────────────────
  function route() {
    var hash = location.hash.slice(1);
    renderByRoute(hash);
    if (!IS_PREVIEW) window.scrollTo(0, 0);
  }

  function rerender() {
    renderByRoute(location.hash.slice(1));
  }

  var _lastBP = getBreakpoint();
  window.addEventListener('resize', function () {
    var bp = getBreakpoint();
    if (bp !== _lastBP) {
      _lastBP = bp;
      if (IS_PREVIEW) renderByRoute(_previewRoute);
      else rerender();
    }
  });

  // ── Theme toggle (live site only) ─────────────────────────────────────────
  function themeIcon() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.07" y2="19.07"/><line x1="4.93" y1="19.07" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.07" y2="4.93"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  function initThemeToggle() {
    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.innerHTML = themeIcon();
    document.querySelector('.nav-inner').appendChild(btn);
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      var rect = btn.getBoundingClientRect();
      document.documentElement.style.setProperty('--vt-x', Math.round(rect.left + rect.width  / 2) + 'px');
      document.documentElement.style.setProperty('--vt-y', Math.round(rect.top  + rect.height / 2) + 'px');
      function doSwitch() {
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        btn.innerHTML = themeIcon();
      }
      if (document.startViewTransition) document.startViewTransition(doSwitch);
      else doSwitch();
    });
  }

  // ── postMessage handler (admin preview) ───────────────────────────────────
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var msg = e.data;

    if (msg.type === 'preview-update') {
      CONFIG = msg.config;
      _previewRoute = msg.route != null ? msg.route : '';
      _previewBP    = msg.bp    != null ? msg.bp    : 'desktop';
      applyDesignerStyles();
      renderPageInfo();
      renderByRoute(_previewRoute);
      return;
    }

    if (msg.type === 'preview-select') {
      document.querySelectorAll('.preview-selected').forEach(function (el) {
        el.classList.remove('preview-selected');
      });
      document.querySelectorAll('.asset-ctrl-strip').forEach(function (el) {
        el.remove();
      });
      if (msg.page === 'asset' && msg.index >= 0) {
        var assetEls = document.querySelectorAll('.asset-tile');
        var selTile  = assetEls[msg.index];
        if (selTile) {
          selTile.classList.add('preview-selected');
          var stripIdx  = msg.index;
          var stripCols = msg.cols || 1;
          var stripRows = msg.rows || 1;
          var strip = document.createElement('div');
          strip.className = 'asset-ctrl-strip';
          strip.innerHTML =
            '<span class="strip-ctrl">' +
              '<button class="strip-btn" data-delta-col="-1">&#8592;</button>' +
              '<span class="strip-count strip-col-count">' + stripCols + '</span>' +
              '<span class="strip-label">col</span>' +
              '<button class="strip-btn" data-delta-col="1">&#8594;</button>' +
            '</span>' +
            '<span class="strip-ctrl">' +
              '<button class="strip-btn" data-delta-row="-1">&#8593;</button>' +
              '<span class="strip-count strip-row-count">' + stripRows + '</span>' +
              '<span class="strip-label">row</span>' +
              '<button class="strip-btn" data-delta-row="1">&#8595;</button>' +
            '</span>' +
            '<button class="strip-btn strip-remove" title="Remove from grid">&#215;</button>';
          strip.querySelectorAll('[data-delta-col]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
              e.stopPropagation();
              window.parent.postMessage({ type: 'asset-span-delta', index: stripIdx, colDelta: parseInt(btn.dataset.deltaCol, 10), rowDelta: 0 }, '*');
            });
          });
          strip.querySelectorAll('[data-delta-row]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
              e.stopPropagation();
              window.parent.postMessage({ type: 'asset-span-delta', index: stripIdx, colDelta: 0, rowDelta: parseInt(btn.dataset.deltaRow, 10) }, '*');
            });
          });
          strip.querySelector('.strip-remove').addEventListener('click', function (e) {
            e.stopPropagation();
            window.parent.postMessage({ type: 'asset-remove', index: stripIdx }, '*');
          });
          selTile.appendChild(strip);
        }
      } else if (msg.page === 'tile' && msg.index >= 0) {
        var tileEls = document.querySelectorAll('.client-tile');
        if (tileEls[msg.index]) tileEls[msg.index].classList.add('preview-selected');
      }
      return;
    }

    if (msg.type === 'theme-change') {
      document.documentElement.setAttribute('data-theme', msg.theme);
      return;
    }

    // Targeted updates — no re-render, no blink ──────────────────────────────

    if (msg.type === 'styles-update') {
      applyStylesObj(msg.styles || {});
      if (CONFIG) CONFIG.designer.styles = msg.styles;
      return;
    }

    if (msg.type === 'hero-text-update') {
      if (CONFIG) { CONFIG.designer.name = msg.name; CONFIG.designer.tagline = msg.tagline; }
      document.title = msg.name;
      var navLogoEl = document.getElementById('nav-logo');
      if (navLogoEl && !navLogoEl.querySelector('img')) navLogoEl.textContent = msg.name;
      var footerNameEl = document.getElementById('footer-name');
      if (footerNameEl) footerNameEl.textContent = msg.name;
      var heroH1 = app && app.querySelector('.hero h1');
      if (heroH1) heroH1.textContent = msg.name;
      var heroP = app && app.querySelector('.hero p');
      if (heroP) heroP.textContent = msg.tagline || '';
      return;
    }

    if (msg.type === 'project-text-update') {
      var titleEl = app && app.querySelector('.client-page-title');
      if (titleEl) titleEl.textContent = msg.name;
      var catEl = app && app.querySelector('.client-page-category');
      if (catEl) catEl.textContent = msg.category || '';
      setBreadcrumb(msg.name);
      return;
    }

    if (msg.type === 'logo-size-update') {
      var tiles = app ? app.querySelectorAll('.client-tile') : [];
      var logoTile = tiles[msg.clientIndex];
      if (logoTile) {
        logoTile.querySelectorAll(':scope > img').forEach(function (img) {
          img.style.maxHeight = msg.size + 'px';
        });
      }
      return;
    }

    if (msg.type === 'tile-attr-update') {
      var tiles2 = app ? app.querySelectorAll('.client-tile') : [];
      var attrTile = tiles2[msg.clientIndex];
      if (attrTile) attrTile.dataset.size = msg.tileSize;
      return;
    }

    if (msg.type === 'asset-span-update') {
      var assetTiles = app ? app.querySelectorAll('.asset-tile') : [];
      var spanTile = assetTiles[msg.assetIndex];
      if (spanTile) {
        var colSpan = msg.cols > 1 ? 'grid-column:span ' + Math.min(msg.cols, msg.totalCols) : '';
        var rowSpan = msg.rows > 1 ? 'grid-row:span '    + msg.rows                           : '';
        spanTile.style.cssText = [colSpan, rowSpan].filter(Boolean).join(';');
        var colCount = spanTile.querySelector('.strip-col-count');
        var rowCount = spanTile.querySelector('.strip-row-count');
        if (colCount) colCount.textContent = msg.cols;
        if (rowCount) rowCount.textContent = msg.rows;
      }
      return;
    }

    if (msg.type === 'grid-style-update') {
      var gridEl = document.getElementById('asset-grid');
      if (gridEl) gridEl.setAttribute('style', msg.style);
      return;
    }
  });

  // ── INIT ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    app = document.getElementById('app');

    if (!IS_PREVIEW) {
      initThemeToggle();
      initLightbox();
      window.addEventListener('hashchange', route);
    }

    fetch('js/config.json?v=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (config) {
        CONFIG = config;
        applyDesignerStyles();
        renderPageInfo();
        route();
      })
      .catch(function () {
        app.innerHTML = '<p style="padding:4rem 2rem;color:#888">Could not load portfolio config.</p>';
      });
  });

}());
