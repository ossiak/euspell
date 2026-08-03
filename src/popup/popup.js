// Popup control surface. Conversion is one global setting in
// browser.storage.sync ({ enabled }); toggling it writes the setting and
// switches the active tab live — no reload — by messaging the content script's
// view mode. The toolbar icon follows the same setting (the service worker
// repaints it), so the switch is visible without opening this popup. Host-access
// granting lives on the onboarding + Options pages, not here.

import { browser } from '../lib/browser.js';
import { paintActionIcon } from '../lib/action-icon.js';
import { isPdfUrl, canViewFileUrls } from '../pdf/pdf-url.js';

const enabledBox = document.getElementById('enabled');
const hint = document.getElementById('hint');
const dictateRow = document.getElementById('dictateRow');
const dictateBtn = document.getElementById('dictate');
const reloadRow = document.getElementById('reloadRow');
const reloadBtn = document.getElementById('reload');

const VIEWER_URL = browser.runtime.getURL('src/pdf/viewer.html');
// Firefox and Safari extensions may not fetch file:// URLs, so the worker leaves
// local PDFs to the native viewer there. Shared with the worker (see pdf-url.js)
// rather than re-tested here: offering a reload the worker will not act on gives
// the user a button that can never work.
const CAN_VIEW_FILE_URLS = canViewFileUrls(VIEWER_URL);

/**
 * True when the active tab holds a PDF the browser is rendering itself, which
 * a reload would hand to our viewer.
 *
 * The hand-off is a navigation-time redirect, so a PDF opened while Euspell was
 * switched off stays in the native viewer — a plugin no extension can reach —
 * until the tab navigates again. Rather than reload anyone's tab uninvited, the
 * popup says so and offers the reload.
 *
 * This mirrors the worker's own .pdf-suffix test, so the offer is only made
 * where it would actually work. An extensionless PDF is not detectable from the
 * URL (the worker finds those by sniffing response headers, which the popup has
 * no access to), so the notice simply does not appear for them.
 *
 * @param {{ url?: string } | undefined} tab
 * @returns {boolean}
 */
function isUnconvertedPdf(tab) {
  const url = tab?.url ?? '';
  if (!isPdfUrl(url) || url.startsWith(VIEWER_URL)) return false;
  if (/^file:/i.test(url) && !CAN_VIEW_FILE_URLS) return false; // a reload would not help
  return true;
}

/** Ask the active tab's content script whether dictation is supported/active. */
async function dictationStatus(tab) {
  if (tab?.id == null) return null;
  try {
    return await browser.tabs.sendMessage(tab.id, { type: 'euspell:dictation:status' });
  } catch {
    return null; // no content script on this page
  }
}

/** True when the active tab is a page Euspell can convert at all. */
function isConvertible(tab) {
  const url = tab?.url ?? '';
  // Our own PDF viewer is a chrome-extension:// page, so a bare protocol test
  // calls it unconvertible — on the one tab that is nothing but conversion. It
  // follows the switch live (see the host seam in src/pdf/host.js), so it must
  // not carry the "can't be converted" hint.
  if (url.startsWith(VIEWER_URL)) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:';
  } catch {
    return false;
  }
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function load() {
  const { enabled = true } = await browser.storage.sync.get('enabled');
  const tab = await activeTab();

  enabledBox.checked = enabled;
  // The switch is global, so it stays usable everywhere; the hint just explains
  // why this particular tab won't change (a chrome:// or web-store page).
  hint.textContent = tab && !isConvertible(tab) ? 'This page can’t be converted.' : '';

  // Only worth offering while conversion is ON: with it off, the native viewer
  // is showing exactly what the user asked for.
  reloadRow.hidden = !(enabled && isUnconvertedPdf(tab));

  // Dictation: shown when the content script is present and the browser supports
  // speech recognition. Independent of the conversion toggle above.
  const dict = await dictationStatus(tab);
  if (dict?.supported) {
    dictateBtn.textContent = dict.active ? 'Stop' : 'Start';
    dictateRow.hidden = false;
  } else {
    dictateRow.hidden = true;
  }
}

/** Switch the active tab's conversion live (no reload) to match the stored
 *  setting, reusing the content script's view-mode machinery. Silently ignored
 *  where there's no content script (a restricted page or the PDF viewer). */
async function applyLive() {
  const tab = await activeTab();
  if (tab?.id == null) return;
  const { enabled = true } = await browser.storage.sync.get('enabled');
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'euspell:setMode', mode: enabled ? 'euspell' : 'original' });
  } catch {
    /* no content script on this page */
  }
}

dictateBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  if (tab?.id == null) return;
  try {
    const res = await browser.tabs.sendMessage(tab.id, { type: 'euspell:dictation:toggle' });
    dictateBtn.textContent = res?.active ? 'Stop' : 'Start';
    // Closing the popup returns focus to the page, so the caret is in the field
    // the user means to dictate into.
    if (res?.active) window.close();
  } catch {
    dictateRow.hidden = true; // content script went away
  }
});

reloadBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  if (tab?.id == null) return;
  // A plain reload re-navigates the tab, which is what the worker's redirect
  // listens for — no need to construct the viewer URL here.
  await browser.tabs.reload(tab.id);
  window.close();
});

enabledBox.addEventListener('change', async () => {
  const on = enabledBox.checked;
  await browser.storage.sync.set({ enabled: on });
  // Paint from here rather than waiting for the service worker to observe the
  // storage change: the worker may be asleep, and the icon is the feedback for
  // this very click. The worker still repaints on its own events, which covers
  // the options page and other synced devices.
  await paintActionIcon(on);
  // Flipping the switch changes whether the reload offer is relevant: turning
  // conversion on over a natively-rendered PDF is exactly when it applies.
  const tab = await activeTab();
  reloadRow.hidden = !(on && isUnconvertedPdf(tab));
  await applyLive();
});

document.getElementById('options').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

load();
