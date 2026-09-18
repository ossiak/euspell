// The viewer's lazy renderer used to track only "does this page hold a canvas",
// which says nothing about a render that is still in flight — and a render is
// asynchronous and slow while the things that invalidate it (zoom, rotation, the
// conversion toggle) are instant. That gap produced two visible faults, and each
// scenario below is one of them, played out against the real state machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPageState, planEvictions, lookaheadPages } from '../src/pdf/render-state.js';

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

// --- aggregate canvas accounting -------------------------------------------
// Per-canvas limits bound one page. The renderer keeps a WINDOW of pages whose
// size is set in page-heights, so the count stays flat while each canvas grows
// with the square of the zoom — which is how a bounded-per-page viewer still
// reached ~1.28 GB in aggregate on a tablet-sized container.

test('live pixels track what is rendered and what is evicted', () => {
  const pages = createPageState();
  const a = wrap();
  const b = wrap();
  assert.equal(pages.livePx(), 0, 'nothing rendered yet');

  pages.begin(a);
  pages.finish(a, 10e6);
  assert.equal(pages.livePx(), 10e6);

  pages.begin(b);
  pages.finish(b, 5e6);
  assert.equal(pages.livePx(), 15e6, 'a second page adds to the total');

  pages.clear(a);
  assert.equal(pages.livePx(), 5e6, 'evicting subtracts exactly what it added');
  pages.clear(b);
  assert.equal(pages.livePx(), 0);
});

test('re-rendering a page replaces its cost instead of doubling it', () => {
  // finish() without an intervening clear() is reachable — a retry, or a future
  // path that redraws in place — and adding blindly would leak the budget away
  // a page at a time until nothing could ever be kept.
  const pages = createPageState();
  const w = wrap();
  pages.begin(w);
  pages.finish(w, 8e6);
  pages.finish(w, 12e6);
  assert.equal(pages.livePx(), 12e6, 'the newer canvas replaces the older cost');
});

test('an unaccounted finish costs nothing rather than NaN', () => {
  // The state-machine tests above call finish(w) with no size, and a NaN here
  // would poison every later comparison against the budget.
  const pages = createPageState();
  const w = wrap();
  pages.begin(w);
  pages.finish(w);
  assert.equal(pages.livePx(), 0);
  pages.clear(w);
  assert.equal(pages.livePx(), 0);
});

// --- which pages to drop ----------------------------------------------------

/** `n` stacked pages of `height`, each holding `px`, in document order. */
const strip = (n, height, px) =>
  Array.from({ length: n }, (_, i) => ({ id: i, px, top: i * height, height }));

test('nothing is evicted while the total fits', () => {
  const pages = strip(8, 1000, 5e6); // 40 Mpx total
  assert.deepEqual(planEvictions(pages, { top: 0, bottom: 800 }, 96e6), []);
});

test('the furthest pages go first, and only as many as needed', () => {
  // 8 pages of 20 Mpx = 160 Mpx against a 96 Mpx budget: 64 Mpx has to go, so
  // four pages, taken from the far end rather than from around the reader.
  const pages = strip(8, 1000, 20e6);
  const viewport = { top: 3000, bottom: 3800 }; // page 3 on screen
  const dropped = planEvictions(pages, viewport, 96e6);
  assert.equal(dropped.length, 4, 'exactly enough to fit, not everything');
  // Page 3 is visible and excluded. Centres are 500, 1500, … 7500 against a
  // viewport middle of 3400, so distance orders them 7 (4100), 6 (3100),
  // 0 (2900), 5 (2100) — the document is longer below the reader than above,
  // which is why the tail goes before the head.
  assert.deepEqual(dropped, [7, 6, 0, 5]);
  assert.ok(!dropped.includes(3), 'the visible page is never chosen');
});

test('a page on screen is never evicted, even under budget pressure', () => {
  // Two pages straddle the viewport and one page alone exceeds the budget, so
  // the only way to get under it would be to blank what the reader is reading.
  const pages = strip(3, 1000, 80e6);
  const viewport = { top: 900, bottom: 2100 }; // overlaps pages 0, 1 and 2
  assert.deepEqual(planEvictions(pages, viewport, 96e6), [], 'visible pages are off limits');
});

test('a single page larger than the whole budget is still shown', () => {
  // The per-canvas cap bounds this case; eviction must not fight it forever.
  const pages = [{ id: 'only', px: 200e6, top: 0, height: 5000 }];
  assert.deepEqual(planEvictions(pages, { top: 0, bottom: 800 }, 96e6), []);
});

// --- lookahead against the budget -------------------------------------------
// The regression these exist for: with a fixed lookahead, a budget that could
// not afford the page it rendered evicted it, the observer re-armed, and it
// rendered again — measured on a tablet-emulated WebView at max zoom as two
// canvases a second, forever, with the live set alternating between two pages.

test('ordinary reading keeps the full lookahead', () => {
  // Small pages: the budget affords far more than the window wants, so this must
  // not change the behaviour that ships today.
  assert.equal(lookaheadPages(96, 2), 2);
  assert.equal(lookaheadPages(13, 2), 2);
});

test('no lookahead when the visible pages alone consume the budget', () => {
  // A page taller than the viewport puts two on screen, and neither can be
  // evicted. Rendering a third only to throw it away is the loop.
  assert.equal(lookaheadPages(2, 2), 0);
  assert.equal(lookaheadPages(1, 2), 0);
});

test('the lookahead grows with what is left over, not with what is affordable', () => {
  assert.equal(lookaheadPages(3, 1), 1);
  assert.equal(lookaheadPages(5, 1), 2);
  assert.equal(lookaheadPages(4, 2), 1);
});

test('the lookahead is never negative, however tight the budget', () => {
  for (const affordable of [0, 1, 2]) {
    for (const onScreen of [1, 2, 5, 20]) {
      assert.ok(lookaheadPages(affordable, onScreen) >= 0, `${affordable}/${onScreen}`);
    }
  }
});

test('pages scrolled past are preferred over the lookahead ahead of the reader', () => {
  // The render lookahead is narrower than the keep window, so freshly rendered
  // pages sit just BELOW the viewport. Evicting those would undo the lookahead
  // and force an immediate re-render; the already-read pages above are the ones
  // to take.
  const pages = strip(6, 1000, 30e6); // 180 Mpx
  const viewport = { top: 4000, bottom: 4800 }; // page 4 visible, 5 is lookahead
  const dropped = planEvictions(pages, viewport, 96e6);
  assert.ok(!dropped.includes(5), 'the lookahead page must survive');
  assert.deepEqual(dropped.slice(0, 3), [0, 1, 2], 'the pages already read go first');
});
