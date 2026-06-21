import { convert } from './converter.js';
import { walkTextNodes } from './dom-walker.js';

// Wrapped in an async IIFE: the content bundle is emitted as an iife (classic
// content script), which forbids top-level await — so the storage read lives
// inside this function. Re-injection or a disabled page returns early.
(async () => {
  if (window.__euspellLoaded) return;
  window.__euspellLoaded = true;

  const { enabled = true } = await chrome.storage.sync.get('enabled');
  if (!enabled) return;

  walkTextNodes(document.body, convert);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) walkTextNodes(node, convert);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.connect().onDisconnect.addListener(() => observer.disconnect());
})();
