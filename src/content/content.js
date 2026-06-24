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

  // characterData is watched (not just childList) so reformed text survives a
  // page that rewrites existing nodes in place (SPA re-renders, live regions).
  // That is also what makes a naive observer loop — see the safeguards below.
  const OBSERVE = { childList: true, subtree: true, characterData: true };
  const observer = new MutationObserver(onMutations);

  walkTextNodes(document.body, convert);
  observer.observe(document.body, OBSERVE);

  // Element subtrees needing (re)conversion, coalesced and flushed once per
  // animation frame so a burst of mutations is handled in a single pass.
  const pending = new Set();
  let scheduled = false;

  // Bound the work a hostile or pathological page can cause:
  //  - per text node: a page that reverts our edit re-triggers conversion; the
  //    guard allows a few rounds then freezes that node, so the ping-pong can't
  //    spin forever (a slow-updating node stays under the limit and keeps going).
  //  - global: if we end up flushing on many consecutive frames, the page is
  //    churning faster than we can settle — stop observing entirely.
  const allow = createRateGuard({ windowMs: 1000, maxPerWindow: 12 });
  const MAX_STREAK = 300; // ~5s of back-to-back frames
  let streak = 0;
  let lastFlush = 0;

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === 'characterData') {
        const tn = m.target;
        if (tn.parentElement && allow(tn)) pending.add(tn.parentElement);
      } else {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) pending.add(node);
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) pending.add(node.parentElement);
        }
      }
    }
    if (pending.size && !scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }

  function flush() {
    scheduled = false;
    const now = performance.now();
    streak = now - lastFlush < 50 ? streak + 1 : 0;
    lastFlush = now;
    if (streak > MAX_STREAK) {
      observer.disconnect();
      pending.clear();
      return;
    }

    const roots = [...pending];
    pending.clear();
    // Disconnect across our writes so they are never re-observed (no
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

  chrome.runtime.connect().onDisconnect.addListener(() => observer.disconnect());
})();
