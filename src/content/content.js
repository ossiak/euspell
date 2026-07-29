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
  // Ownership of the page, not a plain "loaded" flag. Reloading or updating the
  // extension orphans this script but leaves its globals in the isolated world,
  // so a boolean would make the re-injection that follows a silent no-op — the
  // page would stay unconverted until the tab itself reloaded. The service worker
  // clears this before injecting; the orphan then sees it no longer owns the page
  // and leaves the newcomer's work alone (see lifecheck below).
  const OWNER = {};
  if (window.__euspellOwner) return;
  window.__euspellOwner = OWNER;

  // Dictation is an authoring feature independent of page conversion, so it is
  // wired up first — a user can dictate euspell on a site whose pages they don't
  // want reformed.
  initDictation();

  // <all_urls> also matches SVG/XML documents, which have no <body> — nothing to
  // convert or observe (and walkTextNodes/observe would throw on null).
  if (!document.body) return;

  const { enabled = true } = await browser.storage.sync.get('enabled');

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

  // The mode the settings/messages currently ask for, and the one entry point
  // that applies it. 'euspell' first awaits the lexicon — fetched lazily HERE,
  // so a page that never converts (disabled site, global off) never loads the
  // 12.8 MB table at all — and rechecks wantedMode after the await, so a
  // counter-order arriving mid-load wins over the slow path.
  let wantedMode = 'original';
  async function applyMode(mode) {
    wantedMode = mode;
    if (mode === 'original') {
      if (viewMode === 'euspell') restorePage();
      return;
    }
    try {
      await ensureLexicon(); // memoised; a failed fetch resets so a later call retries
    } catch (err) {
      // Without the table a walk is a no-op — leave the page as it is, but keep
      // every listener alive so a later toggle retries (and say why).
      console.warn('Euspell: lexicon unavailable — page left unconverted.', err);
      return;
    }
    if (wantedMode === 'euspell' && viewMode === 'original') convertPage();
  }

  if (enabled) applyMode('euspell');

  // Live conversion toggle from the popup, which sends 'euspell:setMode' so the
  // page switches without a reload. The listener is always registered — even on
  // a page that loaded un-converted — so conversion can be turned on live. A
  // missing responder tells the popup this page has no content script (a
  // restricted page or the viewer).
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // A live script answers; an orphaned one cannot (its runtime belongs to the
    // previous extension instance), and a restricted page has none at all. That
    // is how the worker decides which tabs still need injecting.
    if (msg && msg.type === 'euspell:ping') {
      sendResponse({ alive: true });
      return false;
    }
    if (!msg || msg.type !== 'euspell:setMode') return;
    applyMode(msg.mode === 'euspell' ? 'euspell' : 'original').then(() => sendResponse({ mode: viewMode }));
    return true; // sendResponse is async — the euspell path awaits the lexicon
  });

  // Settings changed anywhere — the popup, the options page, or another synced
  // device. The popup's setMode message reaches only the ACTIVE tab; this
  // listener is what keeps background tabs honest (a toggle-off restores every
  // open tab, not just the front one — and the options page sends no messages at
  // all). Same idempotent guards as the message path, so a tab that also got the
  // popup's message simply no-ops here.
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync' || !('enabled' in changes)) return;
    // Re-read rather than trusting changes.newValue: two toggles in quick
    // succession fire two events whose async work can interleave, and storage
    // always holds the settled answer.
    const { enabled: on = true } = await browser.storage.sync.get('enabled');
    applyMode(on ? 'euspell' : 'original');
  });

  // If the extension is disabled or removed, this already-injected content script
  // is orphaned: its observer keeps converting and the page stays reformed until
  // the tab reloads. Chrome invalidates the runtime of an orphaned script
  // (runtime.id goes undefined; API calls throw), so poll for that and undo
  // ourselves — restore the original text and stop observing. A poll (rather than
  // a runtime port that disconnects on unload) avoids keeping the MV3 service
  // worker alive and the false "removed" signal its idle shutdown would trigger.
  const lifecheck = setInterval(() => {
    let alive = false;
    try {
      alive = !!browser.runtime?.id;
    } catch {
      /* context invalidated */
    }
    if (!alive) {
      clearInterval(lifecheck);
      // Only undo our own work. If the worker has already cleared ownership and
      // injected a replacement, this poll is arriving late and restoring here
      // would strip the reformed text the new instance just applied.
      if (window.__euspellOwner !== OWNER) return;
      window.__euspellOwner = null; // release the page for a future injection
      restorePage();
    }
  }, 3000);

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
