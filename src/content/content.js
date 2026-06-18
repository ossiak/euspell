import { convert } from './converter.js';
import { walkTextNodes } from './dom-walker.js';

if (window.__euspellLoaded) throw new Error('[euspell] already loaded');
window.__euspellLoaded = true;

const { enabled = true } = await chrome.storage.sync.get('enabled');
if (!enabled) throw new Error('[euspell] disabled');

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
