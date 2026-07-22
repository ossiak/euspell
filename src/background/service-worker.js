// Seed default settings on install and keep the toolbar icon in step with them.
// The single "Convert pages" control lives in the popup (src/popup) and options
// page (src/options) — browser.action.onClicked is intentionally NOT used,
// because it never fires while a default_popup is set.
import {
  isPdfUrl,
  isPdfContentType,
  isPdfDisposition,
  isAttachmentDisposition,
  looksLikePdfBytes,
} from '../pdf/pdf-url.js';
import { browser } from '../lib/browser.js';
import { paintActionIcon, refreshActionIcon } from '../lib/action-icon.js';

browser.runtime.onInstalled.addListener(async (details) => {
  const current = await browser.storage.sync.get(['enabled', 'disabledSites']);
  await browser.storage.sync.set({ enabled: current.enabled ?? true });
  // The per-site opt-out list is gone — one global switch now. Drop the stale
  // key so a synced profile doesn't carry it around forever.
  if (current.disabledSites !== undefined) await browser.storage.sync.remove('disabledSites');
  await paintActionIcon(current.enabled ?? true);
  // On a fresh install, open the welcome page — it requests host access, which
  // needs a user gesture and so can't be granted from here. (Not on update.)
  if (details.reason === 'install') {
    browser.tabs.create({ url: browser.runtime.getURL('src/onboarding/onboarding.html') });
  }
});

// An MV3 worker is torn down when idle and restarted on the next event, and a
// setIcon from a previous life does not necessarily survive a browser restart.
// Repaint on startup, on any wake-up, and whenever the setting changes — the
// last of those covers surfaces that are not the popup (the options page, or
// another synced device). The popup paints for itself the moment it is clicked,
// so the icon never waits on this worker being woken.
browser.runtime.onStartup?.addListener(refreshActionIcon);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'enabled' in changes) paintActionIcon(changes.enabled.newValue ?? true);
});
refreshActionIcon(); // also covers a plain worker wake-up

// One-shot redirect bypasses, armed by the viewer's "Open original" link just
// before it navigates (the click awaits this arming round-trip — see
// bypassNextRedirect in ../pdf/host.js). Without this the link would land
// right back in the viewer: both redirect paths below capture the same URL
// again, leaving no way to ever reach the actual file. In-memory is enough —
// the navigation follows the arming within milliseconds, while this worker is
// still awake, and a lost entry costs one more redirect, never a stuck page.
const bypassOnce = new Set();
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'euspell:bypassOnce' || typeof msg.url !== 'string') return;
  bypassOnce.add(msg.url);
  sendResponse({ ok: true });
});

/** Whether this navigation was armed to skip the viewer (consumes the arming). */
function consumeBypass(url) {
  return bypassOnce.delete(url);
}

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
// is the only way in. Both detection paths below honour the same "Convert pages"
// setting as page conversion, and skip our own viewer.
const VIEWER_URL = browser.runtime.getURL('src/pdf/viewer.html');

// Whether this browser lets our viewer read file:// PDFs. Firefox and Safari
// both refuse to let an extension page fetch file:// URLs, so redirecting a
// local PDF into our viewer there would replace the browser's own native
// viewer with an error page the user can't escape — Firefox: moz-extension
// pages may not navigate to file: links; Safari: a file:// fetch from a
// safari-web-extension page fails with "Unexpected server response (0)", and
// there is no per-extension "allow file access" grant as on Chrome. On Chrome a
// file: navigation only reaches us when the user has explicitly enabled "Allow
// access to file URLs", and the viewer can then fetch it.
const CAN_VIEW_FILE_URLS =
  !VIEWER_URL.startsWith('moz-extension:') && !VIEWER_URL.startsWith('safari-web-extension:');

/** Whether the "Convert pages" setting allows converting. */
async function shouldConvert() {
  const { enabled = true } = await browser.storage.sync.get('enabled');
  return enabled;
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
    if (consumeBypass(details.url)) return; // "Open original" — let it through
    if (/^file:/i.test(details.url) && !CAN_VIEW_FILE_URLS) return; // leave local PDFs to Firefox
    if (await shouldConvert()) redirectToViewer(details.tabId, details.url);
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
    if (consumeBypass(details.url)) return; // "Open original" — let it through

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
    if (!isPdf && !isAmbiguousType(contentType)) return;
    // Settings BEFORE the sniff: sniffPdfMagic is a real network request, and a
    // user who has switched Euspell off must not have the extension fetching
    // anything on their behalf.
    if (!(await shouldConvert())) return;
    if (!isPdf) isPdf = await sniffPdfMagic(details.url);
    if (isPdf) redirectToViewer(details.tabId, details.url);
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] },
  ['responseHeaders'],
);
