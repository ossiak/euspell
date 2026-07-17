// Mobile variant of host.js — same API, for a WebView host (Eupub Android) that
// serves this viewer from a virtual origin and has no resident lexicon. A rollup
// alias swaps this file in for the mobile PDF build; see
// rollup.pdf.mobile.config.js.
//
// Two differences from the extension host:
//   • assets come from the host's asset route, not chrome.runtime.getURL
//   • there is no 12.8 MB resident table — each page's vocabulary is fetched
//     from the on-disk SQLite lexicon through the host bridge

import { setLexicon } from '../content/lexicon-source.js';
import { walkTextNodes } from '../content/dom-walker.js';

/**
 * Absolute URL of a bundled asset, given its repo-relative path.
 *
 * The host ships PDF.js's runtime files as a sibling of this page —
 * `dist/pdfjs/x` on disk is served at `../pdfjs/x` relative to the viewer — so
 * resolve against location rather than hardcoding an origin. Trailing slashes
 * survive, which pdf.js requires for its wasm and standard-font directories.
 *
 * @param {string} relPath
 * @returns {string}
 */
export function assetURL(relPath) {
  return new URL(relPath.replace(/^dist\/pdfjs\//, '../pdfjs/'), location.href).href;
}

// A page never usefully exceeds the extension's fixed scale: past this, a fitted
// page is just a big raster nobody asked for. On a phone the fit is far below it
// (~0.55), so this only binds on a tablet or a rotated large screen.
const MAX_SCALE = 1.5;

/**
 * Fit the page to the screen, rather than the extension's fixed 1.5.
 *
 * This is not only about layout. At 1.5 a US-Letter page is 918 CSS px wide — on
 * a 360 px phone that is 2.7x the screen, so the reader sees a third of the line
 * and scrolls sideways for the rest. It is also the memory story: the canvas is
 * backed at scale x devicePixelRatio, so 1.5 on a dpr-3 phone rasterizes
 * 2754x3564 = 9.8 Mpx (~37 MB) per page to show a 336 px-wide column. Fitting to
 * width makes the same page ~1008x1304 (~5.3 MB) — the same pixels the screen can
 * actually show, and ~7x less of them.
 *
 * @param {{ naturalWidth: number, containerWidth: number }} dims  both in CSS px
 * @returns {number}
 */
export function renderScale({ naturalWidth, containerWidth }) {
  if (!(naturalWidth > 0) || !(containerWidth > 0)) return 1; // pre-layout: don't divide by zero
  return Math.min(containerWidth / naturalWidth, MAX_SCALE);
}

// ONE table, installed once and only ever added to. A per-page setLexicon() swap
// would also work today — renders are serialized by enqueueRender, and nothing
// awaits between prepareLexicon and walkTextNodes — but that safety is
// incidental, and would break silently the day rendering stops being serial.
// Growing a single table is safe by construction: adds are monotonic, so a
// concurrent page can only ever observe a superset of what it asked for.
//
// It also means vocabulary saturates. Prose repeats itself, so after a few pages
// most words are already resident and the bridge round-trip (~150-250 ms on a
// mid-range phone) leaves the critical path instead of being paid on every page.
const table = new Map();
setLexicon(table);

/** Words already fetched — present here but absent from `table` means the DB has no entry. */
const seen = new Set();

/**
 * Fetch and install any words under `root` that aren't resident yet.
 *
 * Vocabulary is collected by running the REAL walker with a recording function
 * that returns each word unchanged — not a regex over textContent. That is what
 * guarantees the subset can't diverge from a full-table result: words are
 * grouped and tokenized here exactly as they will be at conversion time. (Same
 * reasoning as Eupub's chapterVocab in src/renderer/reader.js.)
 *
 * A word the DB doesn't know stays in `seen` and out of `table`, so it's asked
 * for once and then passes through unchanged — the documented mobile contract.
 *
 * @param {Node} root  the page's text layer
 * @returns {Promise<void>}
 */
export async function prepareLexicon(root) {
  const words = new Set();
  walkTextNodes(root, (w) => {
    words.add(w.toLowerCase());
    return w;
  });

  const missing = [...words].filter((w) => !seen.has(w));
  if (!missing.length) return;

  // Claim them before awaiting, so a concurrent page doesn't refetch the same words.
  for (const w of missing) seen.add(w);
  try {
    const entries = await window.eupub.lexiconSubset(missing);
    for (const [key, entry] of entries) table.set(key, entry);
  } catch (e) {
    // Unclaim so the next page retries rather than silently passing through forever.
    for (const w of missing) seen.delete(w);
    throw e;
  }
}
