import { convert } from './converter.js';
import { walkTextNodes, restoreOriginals } from './dom-walker.js';
import { createRateGuard } from './reapply-guard.js';
import { initDictation } from '../dictation/index.js';
import { ensureLexicon } from './lexicon-load.js';
import { browser } from '../lib/browser.js';

// Wrapped in an async IIFE: the content bundle is emitted as an iife (classic
// content script), which forbids top-level await — so the storage read lives
// inside this function. A re-injection returns early.
(async () => {
  if (window.__euspellLoaded) return;
  window.__euspellLoaded = true;

  // Dictation is an authoring feature independent of page conversion, so it is
  // wired up first — a user can dictate euspell on a site whose pages they don't
  // want reformed.
  initDictation();

  // The lexicon is fetched at runtime (dist/lexicon.data) rather than inlined
  // into this bundle. Load it before any conversion.
  await ensureLexicon();

  // <all_urls> also matches SVG/XML documents, which have no <body> — nothing to
  // convert or observe (and walkTextNodes/observe would throw on null).
  if (!document.body) return;

  const { enabled = true, disabledSites = [] } = await browser.storage.sync.get([
    'enabled',
    'disabledSites',
  ]);

  // childList catches inserted content (SPA renders); characterData catches text
  // rewritten in place (live regions, re-renders). Watching characterData is what
  // lets reformed text survive a re-render — and what makes a naive observer loop,
  // hence the safeguards below.
  const OBSERVE = { childList: true, subtree: true, characterData: true };
  const observer = new MutationObserver(onMutations);

  // Element subtrees needing (re)conversion, coalesced and flushed on a macrotask
  // so a burst of mutations is handled in one pass. setTimeout (not rAF) so a
  // page loading in a background tab is still converted.
  const pending = new Set();
  let scheduled = false;

  // Per text node guard: a page that reverts our edit re-triggers conversion;
  // allow a few rounds, then freeze that node so a tight revert loop can't spin
  // forever. A slowly updating node (a clock) stays under the limit and keeps
  // converting — only runaway churn on one node is cut, never the whole observer.
  const allow = createRateGuard({ windowMs: 1000, maxPerWindow: 12 });

  // Hold re-application while an IME composition is in progress, so a mutation we
  // didn't cause isn't reconverted mid-edit (editable regions are skipped by the
  // walker already; this also covers exotic editors). Resume when it ends.
  let composing = false;
  addEventListener('compositionstart', () => { composing = true; }, true);
  addEventListener('compositionend', () => { composing = false; schedule(); }, true);

  // Whether the page is currently showing euspell. It starts converting unless
  // the reader is off globally or this site is opted out — but the machinery is
  // always set up, so the popup's per-site (and global) toggle can flip it live,
  // with no reload, via the setMode message below.
  let viewMode = 'original';

  /** Convert the page now and start watching it for changes. */
  function convertPage() {
    walkTextNodes(document.body, convert);
    observer.observe(document.body, OBSERVE);
    viewMode = 'euspell';
  }

  /** Restore the remembered original text (lossless) and stop converting. */
  function restorePage() {
    observer.disconnect();
    // Drop any queued re-conversion: a flush scheduled before the toggle would
    // otherwise re-reform those subtrees and re-observe (its timeout still fires
    // — flush() also checks viewMode as a backstop).
    pending.clear();
    restoreOriginals(document.body);
    viewMode = 'original';
  }

  if (enabled && !disabledSites.includes(location.hostname)) convertPage();

  // Live conversion toggle from the popup. The per-site checkbox (and the global
  // one) send 'euspell:setMode' so a site can be switched on/off without reloading
  // the tab. The listener is always registered — even on a page that loaded
  // un-converted — so conversion can be turned on live. A missing responder tells
  // the popup this page has no content script (a restricted page or the viewer).
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'euspell:setMode') return;
    if (msg.mode === 'original' && viewMode === 'euspell') restorePage();
    else if (msg.mode === 'euspell' && viewMode === 'original') convertPage();
    sendResponse({ mode: viewMode });
  });

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === 'characterData') {
        const el = m.target.parentElement;
        if (el && allow(m.target)) pending.add(el);
      } else {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) pending.add(node);
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) pending.add(node.parentElement);
        }
      }
    }
    schedule();
  }

  function schedule() {
    if (pending.size && !scheduled && !composing && viewMode === 'euspell') {
      scheduled = true;
      setTimeout(flush, 0);
    }
  }

  function flush() {
    scheduled = false;
    // The toggle to 'original' disconnects the observer, but a flush queued
    // before the toggle still fires; converting now (and re-observing below)
    // would drag restored text back to euspell.
    if (viewMode !== 'euspell') return;
    const roots = [...pending];
    pending.clear();
    // Disconnect across our own writes so they are not re-observed (no
    // self-trigger). dom-walker reconverts each node from its remembered original
    // source, so already-reformed siblings in a re-walked block are left as-is.
    // JS is single-threaded, so no page mutation can slip in during this pass.
    observer.disconnect();
    try {
      for (const root of roots) if (root.isConnected) walkTextNodes(root, convert);
    } finally {
      observer.observe(document.body, OBSERVE);
    }
  }
})();
