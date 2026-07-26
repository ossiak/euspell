// Host adapter for the PDF viewer — the two things that differ between the
// extension and a WebView host, behind one seam so viewer.js stays host-agnostic.
//
// THIS FILE IS THE EXTENSION IMPLEMENTATION and the default: nothing aliases it,
// so the extension build resolves it and behaves exactly as before. The mobile
// build swaps in host.mobile.js via a rollup resolver alias, the same idiom
// lexicon-source.js already uses (see rollup.pdf.mobile.config.js, and Eupub's
// rollup.engine.mobile.config.mjs).
//
// Keep host-specific logic HERE, never in viewer.js — a mobile concern leaking
// into the viewer is a cost the extension pays too.

import { browser } from '../lib/browser.js';
import { ensureLexicon } from '../content/lexicon-load.js';

/**
 * Absolute URL of a bundled asset, given its repo-relative path (e.g.
 * 'dist/pdfjs/pdf.worker.min.mjs'). Extension pages resolve these against their
 * own origin.
 *
 * @param {string} relPath
 * @returns {string}
 */
export function assetURL(relPath) {
  return browser.runtime.getURL(relPath);
}

/**
 * The scale to rasterize a page at, in CSS px per PDF pt.
 *
 * The extension renders in a desktop-width tab, where a fixed 1.5 is a readable
 * size and the page is free to be wider than the window — the tab scrolls. A
 * phone-sized host wants the page fitted to the screen instead, so this is a
 * host decision (see host.mobile.js).
 *
 * @param {{ naturalWidth: number, containerWidth: number }} _dims  unused here
 * @returns {number}
 */
export function renderScale(_dims) {
  return 1.5;
}

/**
 * Ensure every word under `root` can be looked up before it is converted.
 *
 * The extension ships one lexicon for the whole document and loads it once, so
 * `root` is unused and repeat calls are free (ensureLexicon memoises the fetch).
 * The mobile host, which has no resident table, uses `root` to fetch just that
 * page's vocabulary. Both are called per page from renderPage.
 *
 * @param {Node} _root  the page's text layer (unused here)
 * @returns {Promise<void>}
 */
export function prepareLexicon(_root) {
  return ensureLexicon();
}

/**
 * Arm a one-shot pass-through for `url` in the service worker's PDF redirect,
 * so the viewer's "Open original" link reaches the actual file instead of
 * bouncing back into this viewer. Resolves once armed; the caller must await
 * it before navigating (the worker consults in-memory state).
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function bypassNextRedirect(url) {
  try {
    await browser.runtime.sendMessage({ type: 'euspell:bypassOnce', url });
  } catch {
    /* worker unreachable — navigate anyway; worst case is one more redirect */
  }
}

// --- conversion switch -----------------------------------------------------
// The viewer is an extension PAGE, not a content-scripted one, so the popup's
// setMode message never reaches it and nothing here reacts to the "Convert
// pages" setting on its own. Without this seam an open PDF stayed reformed
// after the switch was turned off — and stayed reformed across reloads too,
// because the service worker never redirects a viewer URL away from itself.

/**
 * Whether conversion is on right now. Read once at startup; changes arrive
 * through {@link onConversionChange}.
 * @returns {Promise<boolean>}
 */
export async function conversionEnabled() {
  try {
    const { enabled = true } = await browser.storage.sync.get('enabled');
    return enabled;
  } catch {
    return true; // storage unreadable — convert, matching the content script
  }
}

/**
 * Subscribe to "Convert pages" changes from any surface (popup, options page,
 * another synced device).
 * @param {(enabled: boolean) => void} cb
 */
export function onConversionChange(cb) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && 'enabled' in changes) cb(changes.enabled.newValue ?? true);
  });
}

// --- navigation channel ----------------------------------------------------
// Lets an embedding host (Eupub's reader) show a table of contents, a page
// readout, and remember the reading position. The extension viewer is a
// standalone tab with none of that chrome, so the whole channel is inert here:
// wantsNav is false, so viewer.js never computes the outline or tracks the page.

/** Whether the host wants outline/position reporting (see host.mobile.js). */
export const wantsNav = false;

/** Report an outline or a position change to the host. No-op in the extension. */
export function reportNav(_kind, _payload) {}

/** Subscribe to host nav commands (e.g. jump to page). No-op in the extension. */
export function onNavCommand(_cb) {}
