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
     * @returns {boolean} whether the result is still valid. False when the page
     *   was invalidated while it rendered — the caller must evict it, which
     *   re-arms the observer and renders it again at the current scale.
     */
    finish(wrap) {
      const fresh = at(wrap) !== 'stale';
      status.set(wrap, 'rendered');
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
