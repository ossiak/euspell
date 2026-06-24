// Seed default settings on install. The enable/disable controls live in the
// popup (src/popup) and options page (src/options) — chrome.action.onClicked is
// intentionally NOT used, because it never fires while a default_popup is set.
import { isPdfUrl } from '../pdf/pdf-url.js';

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(['enabled', 'disabledSites']);
  await chrome.storage.sync.set({
    enabled: current.enabled ?? true,
    disabledSites: current.disabledSites ?? [],
  });
});

// Redirect top-level navigations to a .pdf onto our own PDF.js viewer, which
// renders the page with reformed text. Chrome's built-in viewer is a native
// plugin a content script can't touch, so a redirect is the only way in. We
// honour the same enabled/disabledSites settings as page conversion, and skip
// our own viewer (which fetches the PDF itself — not a top-level navigation).
const VIEWER_URL = chrome.runtime.getURL('src/pdf/viewer.html');

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) return; // top-level only
    if (!isPdfUrl(details.url) || details.url.startsWith(VIEWER_URL)) return;

    const { enabled = true, disabledSites = [] } = await chrome.storage.sync.get(['enabled', 'disabledSites']);
    if (!enabled) return;
    try {
      if (disabledSites.includes(new URL(details.url).hostname)) return;
    } catch {
      /* file:// has no hostname — fall through and convert */
    }

    chrome.tabs.update(details.tabId, { url: `${VIEWER_URL}?file=${encodeURIComponent(details.url)}` });
  },
  { url: [{ pathSuffix: '.pdf' }, { pathSuffix: '.PDF' }] },
);
