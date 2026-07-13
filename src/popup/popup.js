// Popup control surface. The enable/disable state lives in browser.storage.sync
// ({ enabled, disabledSites }). Toggling the global or per-site control writes the
// setting and switches the active tab live — no reload — by messaging the content
// script's view mode. Host-access granting lives on the onboarding + Options
// pages, not here.

import { browser } from '../lib/browser.js';

const enabledBox = document.getElementById('enabled');
const siteRow = document.getElementById('siteRow');
const siteBox = document.getElementById('site');
const hostEl = document.getElementById('host');
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

/** The active tab's hostname, or null for restricted pages (chrome://, files…). */
function hostnameOf(tab) {
  try {
    const u = new URL(tab.url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function load() {
  const { enabled = true, disabledSites = [] } = await browser.storage.sync.get(['enabled', 'disabledSites']);
  const tab = await activeTab();
  const host = tab ? hostnameOf(tab) : null;

  enabledBox.checked = enabled;

  if (host) {
    hostEl.textContent = host;
    siteBox.checked = !disabledSites.includes(host);
    siteRow.hidden = false;
    // Disable the control itself, not just the ARIA state — a per-site toggle
    // means nothing while the extension is off globally.
    siteBox.disabled = !enabled;
    siteRow.setAttribute('aria-disabled', String(!enabled));
  } else {
    siteRow.hidden = true;
    hint.textContent = 'This page can’t be converted.';
  }

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
 *  settings, reusing the content script's view-mode machinery. Silently ignored
 *  where there's no content script (a restricted page or the PDF viewer). */
async function applyLive() {
  const tab = await activeTab();
  if (tab?.id == null) return;
  const host = hostnameOf(tab);
  const { enabled = true, disabledSites = [] } = await browser.storage.sync.get(['enabled', 'disabledSites']);
  const converting = enabled && !!host && !disabledSites.includes(host);
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'euspell:setMode', mode: converting ? 'euspell' : 'original' });
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
  await browser.storage.sync.set({ enabled: enabledBox.checked });
  siteBox.disabled = !enabledBox.checked;
  siteRow.setAttribute('aria-disabled', String(!enabledBox.checked));
  await applyLive();
});

siteBox.addEventListener('change', async () => {
  const tab = await activeTab();
  const host = tab ? hostnameOf(tab) : null;
  if (!host) return;
  // The service worker is the single writer for disabledSites (concurrent edits
  // from the options page can't be interleaved away).
  await browser.runtime.sendMessage({ type: 'euspell:setSiteDisabled', host, disabled: !siteBox.checked });
  await applyLive();
});

document.getElementById('options').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

load();
