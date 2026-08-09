// The viewer's lazy renderer used to track only "does this page hold a canvas",
// which says nothing about a render that is still in flight — and a render is
// asynchronous and slow while the things that invalidate it (zoom, rotation, the
// conversion toggle) are instant. That gap produced two visible faults, and each
// scenario below is one of them, played out against the real state machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPageState } from '../src/pdf/render-state.js';

const viewer = fs.readFileSync(new URL('../src/pdf/viewer.js', import.meta.url), 'utf8');

/** A stand-in for a page wrapper element — the tracker only uses identity. */
const wrap = () => ({});

test('a page with a render already queued is not queued again', () => {
  // The duplicate-canvas bug. relayout() rebuilds the observers and re-arms
  // every page that needs rendering; observing an already-intersecting element
  // fires its callback immediately, so a page mid-render was enqueued a SECOND
  // time and renderPage ran twice onto the same wrapper.
  const pages = createPageState();
  const w = wrap();
  assert.equal(pages.needsRender(w), true, 'a blank placeholder needs rendering');

  pages.begin(w);
  assert.equal(pages.needsRender(w), false, 'a queued page must not be re-armed');

  pages.finish(w);
  assert.equal(pages.needsRender(w), false, 'nor a rendered one');
});

test('a page invalidated while it renders is reported stale, so it is re-rendered', () => {
  // The stale-scale bug, the same gap seen from the other side: evict() skipped
  // the in-flight page (it held no canvas yet), so it landed at the OLD scale
  // inside a wrapper already resized to the new one, and nothing ever redid it.
  const pages = createPageState();
  const w = wrap();

  pages.begin(w);
  pages.invalidate(w); // the user zooms mid-render
  assert.equal(pages.finish(w), false, 'the canvas that arrives is already wrong');

  // finish() still marks it rendered — the canvas IS in the DOM — so the caller's
  // evict() has something to clear, which re-arms the observer.
  assert.equal(pages.isRendered(w), true);
  pages.clear(w);
  assert.equal(pages.needsRender(w), true, 'and it goes round again at the new scale');
});

test('an uninterrupted render is kept', () => {
  const pages = createPageState();
  const w = wrap();
  pages.begin(w);
  assert.equal(pages.finish(w), true);
  assert.equal(pages.isRendered(w), true);
});

test('invalidating a page that is not rendering changes nothing', () => {
  // relayout invalidates every page indiscriminately. A blank one has no raster
  // to be wrong, and a rendered one is evicted on the spot — only the in-flight
  // case needs remembering, and a blank page must not come back as "stale".
  const pages = createPageState();
  const blank = wrap();
  pages.invalidate(blank);
  assert.equal(pages.needsRender(blank), true, 'still just a placeholder');

  const done = wrap();
  pages.begin(done);
  pages.finish(done);
  pages.invalidate(done);
  assert.equal(pages.isRendered(done), true, 'the caller evicts this one directly');
});

test('a fresh render after an eviction is not tainted by the previous cycle', () => {
  // 'stale' must not survive the round trip: a page invalidated mid-render,
  // evicted, and rendered again would otherwise report stale for ever and
  // re-render on a loop.
  const pages = createPageState();
  const w = wrap();
  pages.begin(w);
  pages.invalidate(w);
  pages.finish(w);
  pages.clear(w);

  pages.begin(w);
  assert.equal(pages.finish(w), true, 'the second attempt stands');
});

test('the keep window is tracked per page and starts closed', () => {
  const pages = createPageState();
  const a = wrap();
  const b = wrap();
  assert.equal(pages.isNear(a), false, 'nothing is near until evictIO says so');
  pages.setNear(a, true);
  assert.equal(pages.isNear(a), true);
  assert.equal(pages.isNear(b), false, 'and it is not global');
  pages.setNear(a, false);
  assert.equal(pages.isNear(a), false);
});

test('renderPage replaces the wrapper contents rather than appending', () => {
  // The defect this module guards against in bookkeeping, guarded here in the
  // DOM write itself: renderPage must leave exactly one canvas and one text
  // layer however it is called. Appending stacked a second canvas below the
  // first (.page canvas is display:block), overflowing into the next page, with
  // two absolutely-positioned text layers so selection returned every word twice.
  assert.match(
    viewer,
    /wrap\.replaceChildren\(canvas, textLayerDiv\)/,
    'renderPage must replaceChildren(canvas, textLayerDiv), never append',
  );
  assert.ok(
    !/wrap\.append\(/.test(viewer),
    'nothing may append to a page wrapper',
  );
});

test('every decision about re-rendering goes through the tracker', () => {
  // A stray `rendered.has(...)` / `near.has(...)` would be exactly the old bug
  // reintroduced: a set that cannot see an in-flight render.
  for (const stray of ['rendered.has(', 'rendered.add(', 'near.has(', 'near.add(']) {
    assert.ok(!viewer.includes(stray), `viewer.js must not track pages with ${stray}…`);
  }
  // Both invalidation paths — scale and spelling — must mark in-flight renders,
  // not merely evict the pages that already hold a canvas.
  assert.match(viewer, /function invalidateAll\(\)/, 'the shared invalidation helper must exist');
  const relayout = /function relayout\(\)[\s\S]*?\n  \}/.exec(viewer)?.[0] ?? '';
  assert.match(relayout, /invalidateAll\(\)/, 'a scale change must invalidate in-flight renders');
  const onToggle = /onConversionChange\(\([\s\S]*?\n  \}\);/.exec(viewer)?.[0] ?? '';
  assert.match(onToggle, /invalidateAll\(\)/, 'a conversion toggle must too');
});

test('the two places that decide a page still needs rendering ask needsRender', () => {
  // isRendered is the right question for evict() — only a page holding a canvas
  // can be emptied — and the WRONG one for these two, which is the whole
  // duplicate-render bug: a page mid-render holds no canvas yet, so asking
  // "is it rendered" says no and it gets queued a second time. The distinction
  // is invisible at the call site, so pin both.
  const arming = /if \((.*?)\) renderIO\.observe\(wrap\)/.exec(viewer);
  assert.ok(arming, 'observe() must arm renderIO conditionally');
  assert.match(
    arming[1],
    /pages\.needsRender\(wrap\)/,
    'arming the render observer must skip pages whose render is already queued',
  );

  const printAll = /async function printAllPages\(\)[\s\S]*?\n    \}/.exec(viewer)?.[0] ?? '';
  assert.ok(printAll.includes('enqueueRender('), 'printAllPages must have been found');
  assert.match(
    printAll,
    /pages\.needsRender\(wrap\)/,
    'printing must not re-queue a page that is already rendering',
  );
  assert.ok(
    !printAll.includes('pages.isRendered('),
    'printing must ask needsRender, not isRendered',
  );
});
