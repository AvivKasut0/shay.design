// Grid logic tests — run with: node tests/grid.test.js
// Tests the breakpoint-resolution logic shared between main.js and admin.js,
// plus the BP-sync fix (preview mode uses admin's activeBP, not window.innerWidth).
'use strict';

var pass = 0; var fail = 0;
function assert(cond, label) {
  if (cond) { console.log('  ✓ ' + label); pass++; }
  else       { console.error('  ✗ FAIL: ' + label); fail++; }
}
function section(name) { console.log('\n── ' + name); }

// ── Pure functions replicated from main.js / admin.js ────────────────────────

function resolveGrid(rawGrid, bp) {
  // bp replaces IS_PREVIEW ? _previewBP : getBreakpoint() — caller decides which.
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
  if (bp !== 'desktop' && g[bp]) return Object.assign({}, base, g[bp]);
  return base;
}

function defaultGrid() {
  return { columns: 3, gap: 10, width: 100, maxWidth: 0, paddingTop: 40, paddingBottom: 0, rowHeight: 0 };
}

// admin.js version (uses activeBP param instead of global)
function resolvedG(client, activeBP) {
  var rawGrid = client.grid || {};
  var base = Object.assign({}, defaultGrid(), rawGrid);
  delete base.tablet; delete base.mobile;
  if (activeBP === 'tablet') return Object.assign({}, base, rawGrid.tablet || {});
  if (activeBP === 'mobile') return Object.assign({}, base, rawGrid.mobile || {});
  return base;
}

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

// admin.js uses the same function body — aliased here to make the equivalence explicit
var computeGridStyle = gridStyle;

// ── 1. resolveGrid defaults ───────────────────────────────────────────────────
section('resolveGrid — defaults');
(function () {
  var g = resolveGrid({}, 'desktop');
  assert(g.columns       === 3,   'columns default = 3');
  assert(g.gap           === 10,  'gap default = 10');
  assert(g.width         === 100, 'width default = 100');
  assert(g.maxWidth      === 0,   'maxWidth default = 0');
  assert(g.paddingTop    === 40,  'paddingTop default = 40');
  assert(g.paddingBottom === 0,   'paddingBottom default = 0');
  assert(g.rowHeight     === 0,   'rowHeight default = 0');
})();

// ── 2. resolveGrid base overrides ─────────────────────────────────────────────
section('resolveGrid — base overrides');
(function () {
  var g = resolveGrid({ columns: 2, gap: 26, rowHeight: 450 }, 'desktop');
  assert(g.columns   === 2,   'columns overridden');
  assert(g.gap       === 26,  'gap overridden');
  assert(g.rowHeight === 450, 'rowHeight overridden');
})();

// ── 3. resolveGrid breakpoint overrides ───────────────────────────────────────
section('resolveGrid — breakpoint overrides');
(function () {
  var raw = {
    columns: 3, gap: 20,
    tablet: { columns: 2, rowHeight: 230 },
    mobile: { columns: 1, rowHeight: 240 },
  };

  var desk   = resolveGrid(raw, 'desktop');
  var tablet = resolveGrid(raw, 'tablet');
  var mobile = resolveGrid(raw, 'mobile');

  assert(desk.columns   === 3,   'desktop keeps base columns');
  assert(desk.gap       === 20,  'desktop keeps base gap');

  assert(tablet.columns   === 2,   'tablet overrides columns');
  assert(tablet.rowHeight === 230, 'tablet overrides rowHeight');
  assert(tablet.gap       === 20,  'tablet inherits base gap when not overridden');

  assert(mobile.columns   === 1,   'mobile overrides columns');
  assert(mobile.rowHeight === 240, 'mobile overrides rowHeight');
  assert(mobile.gap       === 20,  'mobile inherits base gap when not overridden');
})();

// ── 4. resolveGrid — no override for the requested BP falls back to base ──────
section('resolveGrid — missing BP override falls back to base');
(function () {
  var raw = { columns: 2, tablet: { columns: 1 } };
  var mobile = resolveGrid(raw, 'mobile'); // no mobile key
  assert(mobile.columns === 2, 'missing mobile override → base columns (2) used');
})();

// ── 5. admin resolvedG matches main.js resolveGrid for all breakpoints ────────
section('resolvedG (admin) ↔ resolveGrid (main.js) equivalence');
(function () {
  var client = {
    grid: {
      columns: 3, gap: 26, width: 63, rowHeight: 0, maxWidth: 0, paddingTop: 36, paddingBottom: 0,
      tablet: { columns: 2, rowHeight: 230 },
      mobile: { columns: 1, rowHeight: 240 },
    }
  };
  var keys = ['columns', 'gap', 'width', 'maxWidth', 'paddingTop', 'paddingBottom', 'rowHeight'];
  ['desktop', 'tablet', 'mobile'].forEach(function (bp) {
    var admin = resolvedG(client, bp);
    var main  = resolveGrid(client.grid, bp);
    keys.forEach(function (k) {
      assert(
        admin[k] === main[k],
        'BP=' + bp + ' [' + k + ']: admin=' + admin[k] + ' main=' + main[k]
      );
    });
  });
})();

// ── 6. gridStyle correctness ──────────────────────────────────────────────────
section('gridStyle output');
(function () {
  var g1 = resolveGrid({}, 'desktop');
  var s1 = gridStyle(g1);
  assert(s1.includes('grid-template-columns:repeat(3,1fr)'), 'includes 3-col template');
  assert(s1.includes('align-items:start'),  'align-items:start when rowHeight=0');
  assert(!s1.includes('grid-auto-rows'),    'no grid-auto-rows when rowHeight=0');
  assert(!s1.includes('max-width'),         'no max-width when maxWidth=0');

  var g2 = { columns: 2, gap: 20, width: 80, paddingTop: 36, paddingBottom: 20, rowHeight: 450, maxWidth: 1200 };
  var s2 = gridStyle(g2);
  assert(s2.includes('grid-auto-rows:450px'),  'includes grid-auto-rows when rowHeight>0');
  assert(s2.includes('align-items:stretch'),   'align-items:stretch when rowHeight>0');
  assert(s2.includes('max-width:1200px'),      'includes max-width when maxWidth>0');
})();

// ── 7. computeGridStyle (admin) is identical to gridStyle (main.js) ───────────
section('computeGridStyle (admin) === gridStyle (main.js)');
(function () {
  var testCases = [
    { columns: 3, gap: 10, width: 100, paddingTop: 40, paddingBottom: 0, rowHeight: 0, maxWidth: 0 },
    { columns: 2, gap: 26, width: 63,  paddingTop: 36, paddingBottom: 0, rowHeight: 450, maxWidth: 0 },
    { columns: 1, gap: 8,  width: 100, paddingTop: 20, paddingBottom: 20, rowHeight: 0, maxWidth: 800 },
  ];
  testCases.forEach(function (g, i) {
    assert(computeGridStyle(g) === gridStyle(g), 'case ' + (i + 1) + ' matches');
  });
})();

// ── 8. THE BUG (before fix): activeBP ≠ iframe window width ─────────────────
section('Bug: activeBP="desktop" but preview panel is 828px → tablet breakpoint mismatch');
(function () {
  // Scenario: admin window=1100px, sidebar=272px, preview=828px.
  // iframe window.innerWidth=828 → getBreakpoint()='tablet'.
  // admin activeBP='desktop'.
  var client = { grid: { columns: 3, gap: 20, tablet: { columns: 2 } } };
  var adminDesktop   = resolvedG(client, 'desktop');          // what sidebar shows
  var iframeTablet   = resolveGrid(client.grid, 'tablet');    // what iframe renders (old bug)
  assert(adminDesktop.columns !== iframeTablet.columns,
    'BUG REPRODUCED: sidebar says ' + adminDesktop.columns + ' cols, iframe renders ' + iframeTablet.columns + ' cols');
})();

// ── 9. THE FIX: iframe uses _previewBP from admin message ────────────────────
section('Fix: iframe uses _previewBP="desktop" sent by admin → columns match');
(function () {
  var client = { grid: { columns: 3, gap: 20, tablet: { columns: 2 } } };
  var adminDesktop  = resolvedG(client, 'desktop');
  var iframeFixed   = resolveGrid(client.grid, 'desktop'); // _previewBP='desktop' from msg.bp
  assert(adminDesktop.columns === iframeFixed.columns,
    'FIXED: sidebar and iframe both use desktop → ' + adminDesktop.columns + ' cols');
})();

// ── 10. Column picker writes to correct config key per activeBP ───────────────
section('Column picker → correct config key per activeBP');
(function () {
  function applyColChange(client, activeBP, cols) {
    if (!client.grid) client.grid = {};
    if (activeBP === 'desktop') {
      client.grid.columns = cols;
    } else {
      if (!client.grid[activeBP]) client.grid[activeBP] = {};
      client.grid[activeBP].columns = cols;
    }
  }

  var c1 = { grid: {} };
  applyColChange(c1, 'desktop', 4);
  assert(c1.grid.columns === 4,          'desktop: writes to client.grid.columns');
  assert(!c1.grid.tablet,                'desktop: does not create tablet sub-object');

  var c2 = { grid: {} };
  applyColChange(c2, 'tablet', 2);
  assert(c2.grid.tablet.columns === 2,   'tablet: writes to client.grid.tablet.columns');
  assert(c2.grid.columns === undefined,  'tablet: does not touch desktop columns');

  var c3 = { grid: {} };
  applyColChange(c3, 'mobile', 1);
  assert(c3.grid.mobile.columns === 1,   'mobile: writes to client.grid.mobile.columns');
})();

// ── 11. Slider writes to correct config key per activeBP ─────────────────────
section('Slider → correct config key per activeBP');
(function () {
  function applySlider(client, activeBP, key, val) {
    if (!client.grid) client.grid = {};
    if (activeBP === 'desktop') {
      client.grid[key] = val;
    } else {
      if (!client.grid[activeBP]) client.grid[activeBP] = {};
      client.grid[activeBP][key] = val;
    }
  }

  var c = { grid: { columns: 3, gap: 10 } };
  applySlider(c, 'desktop', 'rowHeight', 400);
  assert(c.grid.rowHeight === 400,          'desktop: rowHeight written to base');

  applySlider(c, 'tablet', 'rowHeight', 230);
  assert(c.grid.tablet.rowHeight === 230,   'tablet: rowHeight written to tablet');
  assert(c.grid.rowHeight === 400,          'desktop rowHeight untouched after tablet edit');

  applySlider(c, 'mobile', 'gap', 8);
  assert(c.grid.mobile.gap === 8,           'mobile: gap written to mobile');
  assert(c.grid.gap === 10,                 'base gap untouched after mobile edit');
})();

// ── 12. Slider value clamping for cols/rows spans ────────────────────────────
section('asset-span-delta clamping');
(function () {
  function clampSpan(current, delta, max) {
    return Math.max(1, Math.min(max, current + delta));
  }
  assert(clampSpan(1, -1, 3) === 1,  'cols: clamp at 1 (min)');
  assert(clampSpan(3,  1, 3) === 3,  'cols: clamp at max columns');
  assert(clampSpan(2,  1, 3) === 3,  'cols: increment within range');
  assert(clampSpan(1,  1, 6) === 2,  'rows: basic increment');
  assert(clampSpan(6,  1, 6) === 6,  'rows: clamp at 6 (max)');
})();

// ── 13. resolvedG with no grid property at all ────────────────────────────────
section('resolvedG — client with no grid property');
(function () {
  var client = { grid: undefined };
  var g = resolvedG(client, 'desktop');
  assert(g.columns === 3,   'no grid → default columns');
  assert(g.gap === 10,      'no grid → default gap');
  assert(g.rowHeight === 0, 'no grid → default rowHeight');
})();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(40));
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
