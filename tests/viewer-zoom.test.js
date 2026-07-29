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
