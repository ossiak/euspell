import { convert } from './converter.js';
import { walkTextNodes, restoreOriginals } from './dom-walker.js';
import { createRateGuard } from './reapply-guard.js';
import { initDictation } from '../dictation/index.js';
import { ensureLexicon } from './lexicon-load.js';
import { browser } from '../lib/browser.js';

// Wrapped in an IIFE: the content bundle is emitted as an iife (classic content
// script), so this is the module's own scope. Deliberately NOT async — the whole
// body must run to completion in one synchronous turn, because everything in it
// registers a listener and any await would leave the page half-wired while the
// browser is already delivering events. The one asynchronous thing, reading the
// stored setting, is fired off at the end (applyFromSettings) rather than
// awaited. A re-injection returns early.
(() => {
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
  // convert or observe (walkTextNodes/observe would throw on null), so applyMode
  // stops short of converting on one.
  //
  // Returning outright here is what this replaces. It left the page without the
  // ping responder registered below, so the service worker read it as having no
  // content script and injected a second copy on every install, update and
  // unpacked reload (see injectInto) — each injection stacking another dictation
  // message listener and another focusin listener in the isolated world, so one
  // dictation toggle ended up handled N times.
  const convertible = !!document.body;

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
    // Guarded for the body-less documents that never converted: the orphan
    // lifecheck calls this unconditionally.
    if (document.body) restoreOriginals(document.body);
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
    if (!convertible) return; // no <body> — nothing to walk, and no lexicon needed
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

  /**
   * Apply whatever the stored setting currently says. Both the initial
   * application and every later change go through this single re-read rather
   * than trusting a captured value or changes.newValue: two toggles in quick
   * succession fire events whose async work can interleave, and storage always
   * holds the settled answer.
   */
  async function applyFromSettings() {
    const { enabled = true } = await browser.storage.sync.get('enabled');
    return applyMode(enabled ? 'euspell' : 'original');
  }

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
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !('enabled' in changes)) return;
    applyFromSettings();
  });

  // Only NOW go and read the setting. Every listener above is registered
  // SYNCHRONOUSLY, ahead of this first await, because the window it opens is not
  // dead time: a 'euspell:ping' arriving inside it would go unanswered, and
  // silence is exactly how the service worker decides a tab needs a content
  // script injected (see injectInto) — earning this page a second one on top of
  // the one still starting up.
  applyFromSettings();

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
