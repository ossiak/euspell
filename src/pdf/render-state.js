// Lifecycle bookkeeping for the viewer's lazily-rendered pages.
//
// Split out of viewer.js so it can be tested: viewer.js pulls in pdf.js and
// cannot be imported outside a browser, and these four states are exactly where
// the renderer's races live.
//
// A page wrapper moves blank -> queued -> rendered, and back to blank when it is
// evicted. The fourth state, `stale`, is what the whole module exists for: a
// render is asynchronous and takes far longer than the actions that invalidate
// it, so a page can be rasterizing at the moment the scale changes (zoom, a
// rotation) or the "Convert pages" switch flips. Its output is already wrong
// when it arrives.
//
// Tracking only "does this hold a canvas" — as the viewer did — misses that
// page twice over. It is not yet rendered, so relayout's evict() skips it and
// its stale canvas survives at the old scale; and it is not rendered, so the
// re-armed observer queues a SECOND render onto the same wrapper. Knowing a
// render is already in flight answers both: `needsRender` is false while one is
// pending, and `finish` reports whether the result is still worth keeping.

/** @typedef {'blank' | 'queued' | 'stale' | 'rendered'} PageStatus */

/**
 * How far ahead of the reader it is safe to render, in page-heights.
 *
 * The renderer has two independent policies — a lookahead that decides what to
 * render, and a memory budget that decides what to throw away — and if the
 * lookahead reaches further than the budget can afford they fight: the budget
 * evicts the page the lookahead just rendered, the lookahead's observer re-arms
 * and renders it again, forever. That is not theoretical. On a tablet-emulated
 * WebView at maximum zoom it burned two canvases a second indefinitely, with
 * the live set alternating between the same two pages.
 *
 * So the lookahead is derived from the budget rather than fixed. Pages on screen
 * are counted first because they can never be evicted — a page taller than the
 * viewport puts two of them there at once, and on a large display at high zoom
 * those two can consume the whole budget, leaving no room to read ahead at all.
 * Rendering on demand is the right answer then: it costs a brief wait when
 * scrolling, which is the honest price of pages that large, and it is far better
 * than rasterizing continuously and discarding the result.
 *
 * @param {number} affordable  canvases the budget allows at the current page size
 * @param {number} onScreen  pages that can overlap the viewport at once
 * @param {number} [max]  the lookahead used when memory is not the constraint
 * @returns {number} page-heights to extend the render margin by
 */
export function lookaheadPages(affordable, onScreen, max = 2) {
  // Symmetric margins, so N page-heights either side is about 2N extra pages.
  const spare = Math.floor((affordable - onScreen) / 2);
  return Math.max(0, Math.min(max, spare));
}

/**
 * Which rendered pages to evict to bring the live canvas total inside a budget.
 *
 * Pure, and separated from the DOM for the same reason the tracker above is: the
 * policy has several edges that are easy to get wrong and impossible to reach
 * from a test once it is tangled up with offsetTop and IntersectionObserver.
 *
 * The policy:
 *   • a page overlapping the viewport is never chosen — blanking what the reader
 *     is looking at to save memory trades a visible page for an invisible one,
 *     so a single page larger than the whole budget is still shown (bounding
 *     THAT is the per-canvas cap's job, not this one)
 *   • furthest from the viewport centre goes first, which takes pages already
 *     read before it undoes the renderer's lookahead — the lookahead sits close
 *     to the viewport, and evicting it would only force an immediate re-render
 *   • it stops as soon as the total fits, so nothing is discarded for free
 *
 * @param {{ id: any, px: number, top: number, height: number }[]} rendered
 *   every page currently holding a canvas, in document order
 * @param {{ top: number, bottom: number }} viewport  in the same coordinates
 * @param {number} budget  maximum live backing-store pixels
 * @returns {any[]} ids to evict, in the order they should go
 */
export function planEvictions(rendered, viewport, budget) {
  let live = rendered.reduce((sum, p) => sum + (p.px || 0), 0);
  if (live <= budget) return [];

  const middle = (viewport.top + viewport.bottom) / 2;
  const candidates = rendered
    .filter((p) => !(p.top + p.height > viewport.top && p.top < viewport.bottom))
    .map((p) => ({ p, away: Math.abs(p.top + p.height / 2 - middle) }))
    .sort((a, b) => b.away - a.away);

  const out = [];
  for (const { p } of candidates) {
    if (live <= budget) break;
    out.push(p.id);
    live -= p.px || 0;
  }
  return out;
}

/**
 * Creates a tracker for one document's page wrappers.
 *
 * Keyed weakly, so a caller may hand it any element without extending its
 * lifetime; the viewer keeps its own ordered `wraps` array for iteration.
 */
export function createPageState() {
  /** @type {WeakMap<object, PageStatus>} */
  const status = new WeakMap();
  const near = new WeakSet();
  /** @param {object} wrap @returns {PageStatus} */
  const at = (wrap) => status.get(wrap) ?? 'blank';

  // Backing-store size of each rendered page's canvas, and the running total.
  // Tracked here rather than measured from the DOM on demand because the caller
  // needs it to decide what to evict, and re-reading every canvas's dimensions
  // on each render would be a layout-free but still O(pages) walk on the hot
  // path. The total is what bounds AGGREGATE memory: per-canvas limits say
  // nothing about how many are held at once.
  /** @type {WeakMap<object, number>} */
  const costPx = new WeakMap();
  let liveTotal = 0;

  return {
    /**
     * Whether this page needs a render queued for it — nothing holds a raster
     * and none is on the way. The guard against queueing a second render for a
     * page already being rendered, which would append a second canvas and text
     * layer onto the same wrapper.
     * @param {object} wrap
     */
    needsRender(wrap) {
      return at(wrap) === 'blank';
    },

    /**
     * Whether this page currently holds a canvas, i.e. whether there is
     * anything for the caller to evict.
     * @param {object} wrap
     */
    isRendered(wrap) {
      return at(wrap) === 'rendered';
    },

    /** A render has been queued for this page. @param {object} wrap */
    begin(wrap) {
      status.set(wrap, 'queued');
    },

    /**
     * A queued render finished and its canvas is in the DOM.
     * @param {object} wrap
     * @param {number} [px]  backing-store pixels of the canvas just attached
     *   (width x height, i.e. already multiplied by the raster ratio). Omitted
     *   means "not accounted", which is what the state-machine tests pass.
     * @returns {boolean} whether the result is still valid. False when the page
     *   was invalidated while it rendered — the caller must evict it, which
     *   re-arms the observer and renders it again at the current scale.
     */
    finish(wrap, px) {
      const fresh = at(wrap) !== 'stale';
      status.set(wrap, 'rendered');
      // A DIFFERENCE, not an addition: a page re-rendered without an
      // intervening clear() (relayout evicts, but a retry path need not) would
      // otherwise be counted twice and leak the budget away.
      const cost = Number(px) > 0 ? Number(px) : 0;
      liveTotal += cost - (costPx.get(wrap) || 0);
      costPx.set(wrap, cost);
      return fresh;
    },

    /**
     * This page's raster no longer matches the current scale or spelling. A
     * render in flight is marked so `finish` can report it; a page that already
     * holds a canvas is left for the caller to evict, and a blank one has
     * nothing to invalidate.
     * @param {object} wrap
     */
    invalidate(wrap) {
      if (at(wrap) === 'queued') status.set(wrap, 'stale');
    },

    /** Back to an empty placeholder. @param {object} wrap */
    clear(wrap) {
      status.set(wrap, 'blank');
      liveTotal -= costPx.get(wrap) || 0;
      costPx.delete(wrap);
    },

    /**
     * Backing-store pixels held by every page currently rendered. What the
     * caller's memory budget is enforced against.
     * @returns {number}
     */
    livePx() {
      return liveTotal;
    },

    /** Whether the page is inside the eviction keep window. @param {object} wrap */
    isNear(wrap) {
      return near.has(wrap);
    },

    /** @param {object} wrap @param {boolean} on */
    setNear(wrap, on) {
      if (on) near.add(wrap);
      else near.delete(wrap);
    },
  };
}
