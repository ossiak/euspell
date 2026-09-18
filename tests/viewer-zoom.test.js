// Zoom is wired into the viewer's existing relayout path, which is only
// reachable with a real pdf.js document, so these assert the contract the code
// has to keep rather than driving the DOM: the factor multiplies the host's
// scale, the ladder is symmetric, and the raster stays inside canvas limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../src/pdf/viewer.js', import.meta.url), 'utf8');
const host = fs.readFileSync(new URL('../src/pdf/host.js', import.meta.url), 'utf8');

/** The zoom ladder the viewer declares, read back so the tests track the source. */
const levels = () => {
  const m = /const ZOOM_LEVELS = \[([^\]]+)\]/.exec(js);
  assert.ok(m, 'ZOOM_LEVELS must be declared in viewer.js');
  return m[1].split(',').map((n) => Number(n.trim()));
};
const ZOOM_LEVELS = levels();
/** The clamp setZoom performs on an index. */
const step = (i, by) => Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + by));

/** The raster caps the viewer declares, read back so the tests track the source. */
const num = (name) => {
  const m = new RegExp(`const ${name} = ([0-9.e+]+)`).exec(js);
  assert.ok(m, `${name} must be declared in viewer.js`);
  return Number(m[1]);
};
const MAX_CANVAS_DIM = num('MAX_CANVAS_DIM');
const MAX_CANVAS_PX = num('MAX_CANVAS_PX');
const MAX_LIVE_CANVAS_PX = num('MAX_LIVE_CANVAS_PX');

/** The real rasterRatio, lifted out the same way as zoomIndexFor below. */
const rasterRatio = (() => {
  const m = /\nfunction rasterRatio\(dpr, w, h\) \{[\s\S]*?\n\}/.exec(js);
  assert.ok(m, 'rasterRatio must be declared in viewer.js');
  return new Function('MAX_CANVAS_DIM', 'MAX_CANVAS_PX', `${m[0]}\nreturn rasterRatio;`)(
    MAX_CANVAS_DIM,
    MAX_CANVAS_PX,
  );
})();

/** The backing store rasterRatio would allocate for a w x h CSS-px page. */
const backing = (dpr, w, h) => {
  const r = rasterRatio(dpr, w, h);
  return { ratio: r, w: Math.floor(w * r), h: Math.floor(h * r), px: Math.floor(w * r) * Math.floor(h * r) };
};

/**
 * The real zoomIndexFor, lifted out of the module rather than reimplemented —
 * viewer.js pulls in pdf.js and cannot be imported outside a browser, and a
 * second copy of the rule here would pass while the shipped one regressed.
 */
const zoomIndexFor = (() => {
  const m = /\nfunction zoomIndexFor\(factor\) \{[\s\S]*?\n\}/.exec(js);
  assert.ok(m, 'zoomIndexFor must be declared in viewer.js');
  return new Function('ZOOM_LEVELS', 'ZOOM_DEFAULT', `${m[0]}\nreturn zoomIndexFor;`)(
    ZOOM_LEVELS,
    ZOOM_LEVELS.indexOf(1),
  );
})();

test('zoom multiplies the host scale rather than replacing it', () => {
  // scaleFor folds the user factor in; host.renderScale is the shared contract
  // with the embedding host (Eupub) and must not learn about zoom.
  assert.match(js, /return zoom \* renderScale\(/, 'scaleFor must apply zoom');
  assert.ok(!/zoom/i.test(host), 'host.js must stay free of viewer-only zoom');
});

test('the ladder includes 100% and is sorted', () => {
  assert.ok(ZOOM_LEVELS.includes(1), '100% must be a stop, it is the reset target');
  assert.deepEqual(ZOOM_LEVELS, [...ZOOM_LEVELS].sort((a, b) => a - b));
});

test('a round trip that does not hit a bound lands exactly where it started', () => {
  // The reason for a ladder over a multiplier. Stepping an index cannot
  // accumulate error, and every stop is one the user can read back; multiplying
  // by 1.25 gives 156% and 195% on the way up.
  const start = ZOOM_LEVELS.indexOf(1);
  for (const n of [1, 2]) { // 2 steps down from 100% is the 50% floor exactly
    let i = start;
    for (let k = 0; k < n; k++) i = step(i, -1);
    for (let k = 0; k < n; k++) i = step(i, +1);
    assert.equal(ZOOM_LEVELS[i], 1, `${n} steps out and back should return to 100%`);
  }
});

test('reset restores 100% from anywhere, including from a bound', () => {
  // Stepping into a bound necessarily forgets how far past it you asked to go —
  // true of any clamped stepper — so the readout doubles as a reset control.
  const start = ZOOM_LEVELS.indexOf(1);
  let i = start;
  for (let k = 0; k < 10; k++) i = step(i, -1);
  assert.equal(i, 0, 'pinned at the floor');
  for (let k = 0; k < 4; k++) i = step(i, +1);
  assert.notEqual(ZOOM_LEVELS[i], 1, 'stepping back does not restore it');
  assert.equal(ZOOM_LEVELS[start], 1, 'ZOOM_DEFAULT does');
});

test('zoom stays inside the ladder however hard it is pushed', () => {
  let i = ZOOM_LEVELS.indexOf(1);
  for (let n = 0; n < 40; n++) i = step(i, +1);
  assert.equal(i, ZOOM_LEVELS.length - 1);
  for (let n = 0; n < 40; n++) i = step(i, -1);
  assert.equal(i, 0);
});

test('every stop is a round percentage', () => {
  // The readout is a whole number, so a stop like 1.5625 would display as 156%
  // and never round-trip.
  for (const z of ZOOM_LEVELS) {
    assert.equal(Math.round(z * 100), z * 100, `${z} is not a round percentage`);
  }
});

test('the raster ceiling stays within canvas limits', () => {
  // The canvas is viewport.width * dpr. Guard the worst realistic case — a wide
  // page at max zoom on a 2x display — against the ~16k px per side browsers
  // enforce, since exceeding it silently yields a blank page.
  const BASE_SCALE = 1.5; // renderScale in the extension host
  const widestPageCss = 1684; // A2 landscape at 72dpi, well past letter/A4
  const worst = widestPageCss * BASE_SCALE * Math.max(...ZOOM_LEVELS) * 2;
  assert.ok(worst < 16384, `worst-case canvas ${Math.round(worst)}px exceeds the limit`);
});

test('zoom re-render is debounced, like the resize path', () => {
  // Each step re-runs the whole per-page pipeline — render, text layer, convert,
  // snapshot, redraw — so held-down clicks must coalesce, not queue a render each.
  assert.match(js, /zoomTimer = setTimeout\(relayout,/, 'zoom must debounce relayout');
});

// --- host-driven zoom -------------------------------------------------------
// An embedding host (Eupub) gets a bar-less build: generateViewerHtml strips the
// header, so every control above is absent and zoom arrives over the nav channel
// instead. The host holds the state, because its frame is rebuilt on every open.

test('the embedded viewer takes zoom from its host', () => {
  const cmd = /onNavCommand\(\(c\) => \{[\s\S]*?\n {4}\}\);/.exec(js);
  assert.ok(cmd, 'the nav command handler must be findable');
  assert.match(cmd[0], /c\.zoom != null/, 'a host must be able to set the zoom');
  assert.match(cmd[0], /setZoom\(zoomIndexFor\(c\.zoom\)\)/, 'a host factor goes through the ladder');
});

test('the ladder is published to the host, not duplicated by it', () => {
  // A host with zoom buttons has to step the ladder. Hardcoding a copy over
  // there would be a second ladder to keep in sync across two repos.
  assert.match(js, /reportNav\('ready', \{[^}]*zoomLevels: ZOOM_LEVELS/, "'ready' must carry the ladder");
});

test('a host factor snaps to the nearest stop', () => {
  // The host persists a FACTOR, so what comes back need not be a stop at all:
  // an older ladder, or a hand-edited prefs file.
  assert.equal(ZOOM_LEVELS[zoomIndexFor(1.4)], 1.5);
  assert.equal(ZOOM_LEVELS[zoomIndexFor(0.9)], 1);
  assert.equal(ZOOM_LEVELS[zoomIndexFor(1e6)], Math.max(...ZOOM_LEVELS), 'clamps to the ceiling');
  assert.equal(ZOOM_LEVELS[zoomIndexFor(0.01)], Math.min(...ZOOM_LEVELS), 'clamps to the floor');
});

test('every stop survives the round trip through the host', () => {
  // The host stores what it is told and sends it back on the next open, so each
  // stop must map to itself — otherwise a saved zoom drifts a notch per session.
  for (const z of ZOOM_LEVELS) {
    assert.equal(ZOOM_LEVELS[zoomIndexFor(z)], z, `${z} must round-trip`);
  }
});

test('a junk factor reads as 100% rather than a bound', () => {
  // A corrupt or absent pref has no "nearest" stop worth guessing at, and
  // silently opening every PDF at 50% would look like a rendering bug.
  for (const junk of [undefined, null, NaN, Infinity, 'big']) {
    assert.equal(ZOOM_LEVELS[zoomIndexFor(junk)], 1, `${String(junk)} must fall back to 100%`);
  }
});

// --- the raster cap ---------------------------------------------------------
// Zoom drives the backing store quadratically, and the snapshot renderPage takes
// doubles it. These pin the cap that keeps a magnified page renderable on a
// high-dpr device, and pin that it never costs anything on a page that fits.

// Page sizes in CSS px at a given zoom, for a page fitted to width. Letter is
// 612x792pt, so the aspect is what matters once a host has chosen a width.
const letter = (cssWidth) => ({ w: cssWidth, h: cssWidth * (792 / 612) });

test('a page that fits is backed at full device resolution', () => {
  // The common case, and the one that must not get grainier: zoom 1.
  const { ratio } = backing(2, ...Object.values(letter(918)));
  assert.equal(ratio, 2, 'an unmagnified page must be backed at full dpr');
});

test('the desktop worst case that works today is not made coarser', () => {
  // Letter at the top of the ladder on a dpr-2 display: ~39 Mpx, which the cap
  // is deliberately set just above. If this starts clamping, the cap is too low
  // and desktop readers lost sharpness they had.
  const p = letter(918 * Math.max(...ZOOM_LEVELS));
  const { ratio, px } = backing(2, p.w, p.h);
  assert.ok(px < MAX_CANVAS_PX, `${(px / 1e6).toFixed(0)} Mpx should fit under the cap`);
  assert.equal(ratio, 2, 'the desktop max-zoom case must keep full dpr');
});

test('a high-dpr device at max zoom is pulled inside the budget', () => {
  // The case that motivated the cap: a dpr-3 tablet asks for ~165 Mpx, i.e.
  // ~660 MB of canvas plus as much again of snapshot.
  const p = letter(1200 * Math.max(...ZOOM_LEVELS));
  const uncapped = p.w * 3 * (p.h * 3);
  assert.ok(uncapped > MAX_CANVAS_PX * 3, 'the uncapped ask really is far over budget');
  const { ratio, px } = backing(3, p.w, p.h);
  assert.ok(ratio < 3, 'the ratio must be reduced');
  assert.ok(px <= MAX_CANVAS_PX, `${(px / 1e6).toFixed(0)} Mpx must be within the cap`);
});

test('no page can exceed the per-side limit browsers enforce', () => {
  // Past this a canvas comes back BLANK rather than throwing, so a page that
  // slipped through would fail silently. Swept across the ladder and across
  // plausible fitted widths and shapes.
  for (const dpr of [1, 2, 3, 4]) {
    for (const width of [360, 918, 1200, 1600, 2400]) {
      for (const zoom of ZOOM_LEVELS) {
        for (const aspect of [792 / 612, 0.5, 2]) {
          const w = width * zoom;
          const h = w * aspect;
          const b = backing(dpr, w, h);
          assert.ok(b.w <= MAX_CANVAS_DIM && b.h <= MAX_CANVAS_DIM,
            `${w}x${h} @${dpr}x gave ${b.w}x${b.h}`);
          assert.ok(b.px <= MAX_CANVAS_PX, `${w}x${h} @${dpr}x gave ${(b.px / 1e6).toFixed(0)} Mpx`);
        }
      }
    }
  }
});

test('the aggregate budget leaves room for more than one page', () => {
  // If the budget were below the per-canvas cap, a single large page would put
  // the window permanently over it and eviction would run after every render
  // while never being able to succeed — churn, not protection. Two capped pages
  // is the floor for the viewport page plus the renderer's lookahead.
  assert.ok(
    MAX_LIVE_CANVAS_PX >= MAX_CANVAS_PX * 2,
    `budget ${MAX_LIVE_CANVAS_PX / 1e6} Mpx must hold at least two capped pages (${MAX_CANVAS_PX / 1e6} Mpx each)`,
  );
});

test('an ordinary reading window is nowhere near the budget', () => {
  // The budget must not bite during normal reading, only at high zoom. A letter
  // page fitted to a phone at 100% on a dpr-3 screen, across the ~8-page keep
  // window, is the case that was measured healthy on a device.
  const perPage = 360 * 3 * (360 * (792 / 612) * 3); // CSS px x dpr, both axes
  assert.ok(perPage * 8 < MAX_LIVE_CANVAS_PX / 2, `${((perPage * 8) / 1e6).toFixed(0)} Mpx should be far under budget`);
});

test('the budget is enforced on the render path, and only there', () => {
  // It has to run where a canvas is ADDED. Hanging it off scroll instead would
  // let a burst of renders overshoot before anything checked.
  assert.match(js, /pages\.finish\(wrap, canvas \? canvas\.width \* canvas\.height : 0\)/,
    'finish must be told the canvas cost');
  assert.match(js, /else enforceCanvasBudget\(\)/, 'a kept canvas must trigger the budget check');
  assert.match(js, /planEvictions\(rendered, viewport, MAX_LIVE_CANVAS_PX\)/,
    'the policy must come from render-state, not be reimplemented here');
  // Printing deliberately holds every page at once; the budget must stand aside
  // rather than fight it (evict() no-ops while printing, so this would spin).
  const fn = /function enforceCanvasBudget\(\) \{[\s\S]*?\n {2}\}/.exec(js);
  assert.ok(fn, 'enforceCanvasBudget must be findable');
  assert.match(fn[0], /if \(printing\) return;/, 'printing must be exempt');
});

test('the cap never sharpens a page beyond its display', () => {
  // It is a ceiling, not a target: a small page on a 1x display stays at 1x.
  for (const dpr of [1, 2, 3]) {
    assert.ok(rasterRatio(dpr, 400, 500) <= dpr);
  }
});

test('the canvas and the colour sampling use one ratio', () => {
  // getImageData works in backing-store pixels, so the span boxes the reformed
  // words sample their ink/paper from must be scaled by the SAME ratio the
  // canvas was sized with. When that was dpr in both places they could not
  // drift; now that one is capped, a stray `* dpr` would sample the wrong
  // pixels and paint reformed words in the wrong colours.
  // Comments stripped: prose may still describe the old "viewport x dpr" shape.
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/\* dpr\b/.test(code), 'no code may still multiply by raw dpr');
  assert.match(js, /canvas\.width = Math\.floor\(viewport\.width \* raster\)/);
  assert.match(js, /Math\.round\(o\.x \* raster\)/);
  assert.match(js, /ctx\.scale\(raster, raster\)/);
});
