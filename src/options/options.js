// Options page. Mirrors the same browser.storage.sync state the popup uses
// ({ enabled }) and stays in sync live via storage.onChanged.

import { browser } from '../lib/browser.js';

const enabledBox = document.getElementById('enabled');
const accessHint = document.getElementById('accessHint');
const grantBtn = document.getElementById('grant');

// Host access lives here (not the popup): the onboarding page grants it on
// install, and this is the recovery path if the user later revokes it.
// Broad-host patterns any of which means "can read all sites" — the extension
// only holds <all_urls>, but Chrome may report it verbatim or as expanded
// scheme wildcards, so accept either form.
const BROAD_HOST = new Set(['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*']);

/** Whether the extension holds broad host access, read from the GRANTED list
 *  (permissions.getAll) — permissions.contains() is unreliable on Chrome for a
 *  manifest <all_urls> grant. Assume granted if the API is unavailable. */
async function hasBroadHostAccess() {
  try {
    const { origins = [] } = await browser.permissions.getAll();
    return origins.some((o) => BROAD_HOST.has(o));
  } catch {
    return true;
  }
}

async function refreshAccess() {
  const granted = await hasBroadHostAccess();
  accessHint.textContent = granted
    ? 'Euspell can read and convert the pages you visit.'
    : 'Turned off — Euspell can’t read pages until you grant access.';
  grantBtn.hidden = granted;
}

grantBtn.addEventListener('click', async () => {
  try {
    await browser.permissions.request({ origins: ['<all_urls>'] });
  } catch {
    /* prompt unavailable — the user can grant it from the add-on's settings */
  }
  await refreshAccess();
});

async function getState() {
  return browser.storage.sync.get('enabled');
}

function render({ enabled = true }) {
  enabledBox.checked = enabled;
}

enabledBox.addEventListener('change', () => {
  browser.storage.sync.set({ enabled: enabledBox.checked });
});

// Keep the page current if the popup (or another options tab) changes the setting.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'enabled' in changes) getState().then(render);
});

getState().then(render);
refreshAccess();
