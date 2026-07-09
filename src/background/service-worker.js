// Seed default settings on install. The enable/disable controls live in the
// popup (src/popup) and options page (src/options) — browser.action.onClicked is
// intentionally NOT used, because it never fires while a default_popup is set.
import {
  isPdfUrl,
  isPdfContentType,
  isPdfDisposition,
  looksLikePdfBytes,
} from '../pdf/pdf-url.js';
import { browser } from '../lib/browser.js';

browser.runtime.onInstalled.addListener(async () => {
  const current = await browser.storage.sync.get(['enabled', 'disabledSites']);
  await browser.storage.sync.set({
    enabled: current.enabled ?? true,
    disabledSites: current.disabledSites ?? [],
  });
});

// Keyboard shortcut (chrome://extensions/shortcuts) toggles dictation in the
// active tab. The content script owns the recognizer and inserts at the caret,
// so we just forward the toggle; a page with no content script (chrome://, the
// web store) simply has no receiver and the send is ignored.
browser.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-dictation') return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'euspell:dictation:toggle' });
  } catch {
    /* no content script on this page */
  }
});

// We render PDFs in our own PDF.js viewer (reformed text). Chrome's built-in
// viewer is a native plugin a content script can't touch, so redirecting the tab
// is the only way in. Both detection paths below honour the same enabled/
// disabledSites settings as page conversion, and skip our own viewer.
const VIEWER_URL = browser.runtime.getURL('src/pdf/viewer.html');

/** Whether the global toggle / per-site opt-out allow converting this URL. */
async function shouldConvert(url) {
  const { enabled = true, disabledSites = [] } = await browser.storage.sync.get([
    'enabled',
    'disabledSites',
  ]);
  if (!enabled) return false;
  try {
    if (disabledSites.includes(new URL(url).hostname)) return false;
  } catch {
    /* file:// has no hostname — fall through and convert */
  }
  return true;
}

/** Send the tab to our viewer with the original PDF URL in `?file=`. */
function redirectToViewer(tabId, url) {
  browser.tabs.update(tabId, { url: `${VIEWER_URL}?file=${encodeURIComponent(url)}` });
}

// Path 1: URL ends in .pdf. onBeforeNavigate fires before any request goes out,
// so this catches the common case with no network cost and no viewer flash.
browser.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) return; // top-level only
    if (!isPdfUrl(details.url) || details.url.startsWith(VIEWER_URL)) return;
    if (await shouldConvert(details.url)) redirectToViewer(details.tabId, details.url);
  },
  { url: [{ pathSuffix: '.pdf' }, { pathSuffix: '.PDF' }] },
);

// A Content-Type that names a generic binary blob — worth sniffing the body for a
// PDF signature, since some servers serve PDFs this way (or with no type at all).
function isAmbiguousType(value) {
  if (!value) return true;
  const type = value.split(';', 1)[0].trim().toLowerCase();
  return (
    type === 'application/octet-stream' ||
    type === 'binary/octet-stream' ||
    type === 'application/download' ||
    type === 'application/force-download'
  );
}

// Fetch just the document's first bytes and test for the %PDF- signature. The
// Range header keeps honouring servers to ~1 KB; for servers that ignore it we
// read only the first stream chunk and cancel, so we never pull a whole file.
async function sniffPdfMagic(url) {
  try {
    const resp = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    if (!resp.ok && resp.status !== 206) return false;
    if (!resp.body) {
      return looksLikePdfBytes(new Uint8Array(await resp.arrayBuffer()));
    }
    const reader = resp.body.getReader();
    const { value } = await reader.read();
    reader.cancel();
    return looksLikePdfBytes(value);
  } catch {
    return false;
  }
}

// Path 2: extensionless PDFs. A URL with no .pdf suffix can still be a PDF, and
// onBeforeNavigate can't know that — it has no response yet. Inspect each
// top-level response's headers: Content-Type (the server's MIME type) and
// Content-Disposition (an attachment filename) are the reliable signals; when the
// type is an ambiguous binary blob, fall back to sniffing the leading bytes for
// the %PDF- structure. Any hit promotes the page to our viewer.
browser.webRequest.onHeadersReceived.addListener(
  async (details) => {
    if (details.type !== 'main_frame') return;
    if (details.url.startsWith(VIEWER_URL)) return;
    if (isPdfUrl(details.url)) return; // already handled by onBeforeNavigate

    const headers = details.responseHeaders ?? [];
    const header = (name) =>
      headers.find((h) => h.name.toLowerCase() === name)?.value;
    const contentType = header('content-type');

    let isPdf =
      isPdfContentType(contentType) || isPdfDisposition(header('content-disposition'));
    if (!isPdf && isAmbiguousType(contentType)) {
      isPdf = await sniffPdfMagic(details.url);
    }
    if (!isPdf) return;

    if (await shouldConvert(details.url)) redirectToViewer(details.tabId, details.url);
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] },
  ['responseHeaders'],
);
