// Popup control surface. The enable/disable state lives in browser.storage.sync
// ({ enabled, disabledSites }). Toggling the global or per-site control writes the
// setting and switches the active tab live — no reload — by messaging the content
// script's view mode. Only re-granting host access reloads (the content script has
// to be injected before it can convert).

import { browser } from '../lib/browser.js';

const enabledBox = document.getElementById('enabled');
const siteRow = document.getElementById('siteRow');
const siteBox = document.getElementById('site');
const hostEl = document.getElementById('host');
const hint = document.getElementById('hint');
const dictateRow = document.getElementById('dictateRow');
const dictateBtn = document.getElementById('dictate');
const permRow = document.getElementById('permRow');
const grantBtn = document.getElementById('grant');

// Broad-host patterns any of which means "can read all sites". The extension
// only ever holds <all_urls>; Chrome may report it verbatim or as expanded
// scheme wildcards, so accept either form.
const BROAD_HOST = new Set(['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*']);

/** Whether the extension holds broad host access, read from the GRANTED list
 * (permissions.getAll) rather than permissions.contains(). contains() proved
 * unreliable on Chrome for a manifest <all_urls> grant — it answers false even
 * when the profile records the permission as fully granted — whereas getAll
 * reports the actual granted origins. Used only to SUPPRESS a false notice; the
 * authoritative positive signal is the content script replying (see load()).
 * Assumes access if the API is unavailable, rather than nag. */
async function hasBroadHostAccess() {
  try {
    const { origins = [] } = await browser.permissions.getAll();
    return origins.some((o) => BROAD_HOST.has(o));
  } catch {
    return true;
  }
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

  // Does the content script respond? A reply proves it injected here, which
  // proves the extension has host access to this page — the authoritative
  // signal, since permissions.contains() is unreliable on Chrome. The listener
  // is registered before the enable/disable gate, so it answers even on a
  // disabled page.
  const dict = await dictationStatus(tab);
  const contentScriptPresent = dict != null;

  // Show the "no access" notice only on a normal (http/https) page where the
  // content script did NOT load AND the granted list shows no broad host
  // access. Content scripts aren't injected into tabs opened before the
  // extension loaded, so absence alone isn't proof — the granted-list check
  // keeps the notice hidden on those (and on still-loading or script-blocking
  // pages) whenever access is actually held.
  permRow.hidden = !host || contentScriptPresent || (await hasBroadHostAccess());

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
  // speech recognition. Independent of the conversion toggle. Reuses the dict
  // status fetched for the access check.
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

/** Reload the active tab — used only after (re)granting host access, so the
 *  content script gets injected and can start converting. */
async function reloadActiveTab() {
  const tab = await activeTab();
  if (tab?.id != null) await browser.tabs.reload(tab.id);
  hint.textContent = 'Reloading…';
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

grantBtn.addEventListener('click', async () => {
  let granted = false;
  try {
    // Re-requesting a host permission listed in host_permissions is allowed
    // and shows the browser's own grant prompt (needs this click's gesture).
    granted = await browser.permissions.request({ origins: ['<all_urls>'] });
  } catch {
    /* prompt unavailable — the user can grant it from the add-on's settings */
  }
  if (granted) {
    permRow.hidden = true;
    await reloadActiveTab();
  }
});

document.getElementById('options').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

load();
