// Seed default settings on install. The enable/disable controls live in the
// popup (src/popup) and options page (src/options) — browser.action.onClicked is
// intentionally NOT used, because it never fires while a default_popup is set.
import {
  isPdfUrl,
  isPdfContentType,
  isPdfDisposition,
  isAttachmentDisposition,
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

// Single writer for disabledSites. The popup and options page used to each do
// their own read-modify-write on the array; two near-simultaneous edits (both
// surfaces open) could interleave and silently drop one. They now send their
// edit here, where a promise queue serializes the read→mutate→write cycles.
let sitesQueue = Promise.resolve();
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'euspell:setSiteDisabled' || typeof msg.host !== 'string') return;
  const run = sitesQueue.then(async () => {
    const { disabledSites = [] } = await browser.storage.sync.get('disabledSites');
    const set = new Set(disabledSites);
    if (msg.disabled) set.add(msg.host);
    else set.delete(msg.host);
    const sites = [...set];
    await browser.storage.sync.set({ disabledSites: sites });
    return sites;
  });
  sitesQueue = run.catch(() => {}); // a failed write must not wedge the queue
  run.then(
    (sites) => sendResponse({ ok: true, disabledSites: sites }),
    (e) => sendResponse({ ok: false, error: String(e) }),
  );
  return true; // sendResponse is async (cross-browser: Chrome ignores a returned Promise)
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

// Whether this browser lets our viewer read file:// PDFs. Firefox never allows
// extensions to fetch file:// URLs, so redirecting a local PDF there would
// replace Firefox's native viewer with an error page the user can't even
// escape (moz-extension pages may not navigate to file: links). On Chrome a
// file: navigation only reaches us when the user has explicitly enabled
// "Allow access to file URLs", and the viewer can then fetch it.
const CAN_VIEW_FILE_URLS = !VIEWER_URL.startsWith('moz-extension:');

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
    /* unparsable URL — nothing to match against the site list; convert.
       (file:// parses fine, with an empty hostname that's never listed.) */
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
    if (/^file:/i.test(details.url) && !CAN_VIEW_FILE_URLS) return; // leave local PDFs to Firefox
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
//
// Known tradeoff: detecting this way means the original response is already
// in flight (headers, then body) by the time we redirect, and the viewer then
// fetches the same URL again via PDF.js — up to three requests total for one
// document (the original navigation, an optional small sniff Range request,
// and the viewer's real fetch), with the original body's bytes discarded.
// That's wasted bandwidth for large files and can break one-time-use/signed
// download links outright if a later fetch is rejected as already-consumed.
// There's no way to detect an extensionless PDF without letting at least the
// headers of one real request through, so this is accepted rather than fixed.
browser.webRequest.onHeadersReceived.addListener(
  async (details) => {
    if (details.type !== 'main_frame') return;
    if (details.method !== 'GET') return; // a re-fetched GET can't reproduce a POST's response
    if (details.url.startsWith(VIEWER_URL)) return;
    if (isPdfUrl(details.url)) return; // already handled by onBeforeNavigate

    const headers = details.responseHeaders ?? [];
    const header = (name) =>
      headers.find((h) => h.name.toLowerCase() === name)?.value;
    const contentType = header('content-type');
    const disposition = header('content-disposition');

    // An attachment response is already being saved to disk by the browser's
    // own download manager, which onHeadersReceived can't cancel in MV3 —
    // redirecting here would just fetch a second copy into our viewer on top
    // of the file the browser is downloading, so leave it alone.
    if (isAttachmentDisposition(disposition)) return;

    let isPdf = isPdfContentType(contentType) || isPdfDisposition(disposition);
    if (!isPdf && isAmbiguousType(contentType)) {
      isPdf = await sniffPdfMagic(details.url);
    }
    if (!isPdf) return;

    if (await shouldConvert(details.url)) redirectToViewer(details.tabId, details.url);
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] },
  ['responseHeaders'],
);
