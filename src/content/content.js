import { convert } from './converter.js';
import { walkTextNodes } from './dom-walker.js';
import { createRateGuard } from './reapply-guard.js';

// Wrapped in an async IIFE: the content bundle is emitted as an iife (classic
// content script), which forbids top-level await — so the storage read lives
// inside this function. Re-injection or a disabled page returns early.
(async () => {
  if (window.__euspellLoaded) return;
  window.__euspellLoaded = true;

  const { enabled = true, disabledSites = [] } = await chrome.storage.sync.get(['enabled', 'disabledSites']);
  if (!enabled || disabledSites.includes(location.hostname)) return;

  // childList catches inserted content (SPA renders); characterData catches text
  // rewritten in place (live regions, re-renders). Watching characterData is what
  // lets reformed text survive a re-render — and what makes a naive observer loop,
  // hence the safeguards below.
  const OBSERVE = { childList: true, subtree: true, characterData: true };
  const observer = new MutationObserver(onMutations);

  walkTextNodes(document.body, convert);
  observer.observe(document.body, OBSERVE);

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
    if (pending.size && !scheduled && !composing) {
      scheduled = true;
      setTimeout(flush, 0);
    }
  }

  function flush() {
    scheduled = false;
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
