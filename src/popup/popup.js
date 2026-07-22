// Popup control surface. Conversion is one global setting in
// browser.storage.sync ({ enabled }); toggling it writes the setting and
// switches the active tab live — no reload — by messaging the content script's
// view mode. The toolbar icon follows the same setting (the service worker
// repaints it), so the switch is visible without opening this popup. Host-access
// granting lives on the onboarding + Options pages, not here.

import { browser } from '../lib/browser.js';
import { paintActionIcon } from '../lib/action-icon.js';

const enabledBox = document.getElementById('enabled');
const hint = document.getElementById('hint');
const dictateRow = document.getElementById('dictateRow');
const dictateBtn = document.getElementById('dictate');

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
  try {
    const u = new URL(tab.url);
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

enabledBox.addEventListener('change', async () => {
  const on = enabledBox.checked;
  await browser.storage.sync.set({ enabled: on });
  // Paint from here rather than waiting for the service worker to observe the
  // storage change: the worker may be asleep, and the icon is the feedback for
  // this very click. The worker still repaints on its own events, which covers
  // the options page and other synced devices.
  await paintActionIcon(on);
  await applyLive();
});

document.getElementById('options').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

load();
