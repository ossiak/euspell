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
  canViewFileUrls,
} from '../pdf/pdf-url.js';
import { browser } from '../lib/browser.js';
import { paintActionIcon, refreshActionIcon } from '../lib/action-icon.js';

// Declarative content_scripts run only when a page loads, so reloading, updating
// or re-enabling the extension leaves every ALREADY-OPEN tab without a working
// script: the old one is orphaned the moment its runtime is invalidated, and
// Chrome does not re-inject. Pages then sit unconverted until the user reloads
// each tab — which looks like the extension is simply broken after an update.
//
// Inject into those tabs ourselves. Each is pinged first, because a tab that
// still has a LIVE script must not get a second one; only silence (no script, an
// orphan, or a restricted page) earns an injection.
const CONTENT_BUNDLE = 'dist/content-bundle.js';

async function injectInto(tabId) {
  try {
    const reply = await browser.tabs.sendMessage(tabId, { type: 'euspell:ping' });
    if (reply?.alive) return false; // a live script already owns this tab
  } catch {
    /* no responder: nothing there, or an orphan from the previous instance */
  }
  try {
    // Release the previous instance's claim first. Its globals outlive it in the
    // isolated world, and the bundle returns early on a claimed page — so without
    // this the injection below would do nothing at all.
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => { window.__euspellOwner = null; },
    });
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_BUNDLE] });
    return true;
  } catch {
    // Restricted by design — chrome://, the Web Store, PDF viewers, other
    // extensions' pages. Nothing to report; those tabs are simply not ours.
    return false;
  }
}

/** Re-inject into every tab that has no live content script. */
async function reinjectAllTabs() {
  let tabs = [];
  try {
    tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  } catch {
    return;
  }
  await Promise.all(tabs.map((t) => (t.id === undefined ? false : injectInto(t.id))));
}

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
  // Fires for a first install, a version update, and a manual reload of an
  // unpacked build — every case that strands open tabs without a script.
  await reinjectAllTabs();
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

// Whether this browser lets our viewer read file:// PDFs — see pdf-url.js. The
// popup asks the same question to decide whether to offer a reload, so the test
// lives there and both read it from one place.
const CAN_VIEW_FILE_URLS = canViewFileUrls(VIEWER_URL);

// The PDF counterpart of the DOM's data-euspell="off": a site keeps a document
// out of our viewer by linking it with `euspell=off` in the query string. A PDF
// has no markup for an attribute to live in, and the .pdf path below fires on
// onBeforeNavigate — before any response exists — so the URL is the only signal
// available in time. Used for the euspell white paper itself, which quotes
// traditional spellings and must not be reformed.
function isOptedOut(url) {
  try {
    return new URL(url).searchParams.get('euspell')?.toLowerCase() === 'off';
  } catch {
    return false; // not a parseable URL — nothing to opt out of
  }
}

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
    if (isOptedOut(details.url)) return; // the page asked to stay traditional
    if (consumeBypass(details.url)) return; // "Open original" — let it through
    if (/^file:/i.test(details.url) && !CAN_VIEW_FILE_URLS) return; // leave local PDFs to Firefox/Safari
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

// Path 2: extensionless PDFs, and PDFs embedded in a first-level iframe. A URL
// with no .pdf suffix can still be a PDF, and onBeforeNavigate can't know that —
// it has no response yet. Inspect each response's headers: Content-Type (the
// server's MIME type) and Content-Disposition (an attachment filename) are the
// reliable signals; when the type is an ambiguous binary blob, fall back to
// sniffing the leading bytes for the %PDF- structure. Any hit promotes the page
// to our viewer.
//
// This also covers the common "wrapper" page whose body is a single <iframe>
// holding the real PDF (a sub_frame response). A PDF the browser renders in its
// native plugin inside a frame is unreachable to a content script, so we redirect
// the WHOLE tab to our viewer on that frame's URL. Restricted to direct children
// of the main frame (parentFrameId 0) so a deep ad/tracking frame that happens to
// serve a PDF can't hijack the tab; a page embedding a PDF as one element among
// others is taken over too, which is the accepted cost of converting it at all.
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
    const topLevel = details.type === 'main_frame';
    // A PDF loaded directly inside the page — a first-level iframe, the shape a
    // site uses to preview/host a PDF behind an extensionless wrapper URL.
    const embedded = details.type === 'sub_frame' && details.parentFrameId === 0;
    if (!topLevel && !embedded) return;
    if (details.method !== 'GET') return; // a re-fetched GET can't reproduce a POST's response
    if (details.url.startsWith(VIEWER_URL)) return;
    // A main-frame .pdf is already handled by onBeforeNavigate; a framed .pdf is
    // not (that listener is top-level only), so let an embedded one through and
    // count the suffix as a positive signal below.
    if (topLevel && isPdfUrl(details.url)) return;
    if (isOptedOut(details.url)) return; // the page asked to stay traditional
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

    let isPdf =
      isPdfContentType(contentType) || isPdfDisposition(disposition) || isPdfUrl(details.url);
    if (!isPdf && !isAmbiguousType(contentType)) return;
    // Settings BEFORE the sniff: sniffPdfMagic is a real network request, and a
    // user who has switched Euspell off must not have the extension fetching
    // anything on their behalf.
    if (!(await shouldConvert())) return;
    if (!isPdf) isPdf = await sniffPdfMagic(details.url);
    // Redirect the whole tab; for an embedded PDF this navigates the tab away
    // from the wrapper page to our viewer on the framed PDF's own URL.
    if (isPdf) redirectToViewer(details.tabId, details.url);
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'sub_frame'] },
  ['responseHeaders'],
);
