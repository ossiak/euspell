// Onboarding page, opened once on install (see service-worker.js). Its job is to
// request host access — the grant needs a user gesture, so it can't happen in
// the install handler. On Chrome access is usually already granted at install,
// so this shows "you're all set"; on Firefox (host access is opt-in) it leads
// with the Grant button.

import { browser } from '../lib/browser.js';

const grantSection = document.getElementById('grantSection');
const readySection = document.getElementById('readySection');
const grantBtn = document.getElementById('grant');

// Broad-host patterns any of which means "can read all sites". The extension
// only ever holds <all_urls>; Chrome may report it verbatim or as expanded
// scheme wildcards, so accept either form.
const BROAD_HOST = new Set(['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*']);

/** Whether the extension holds broad host access, read from the GRANTED list
 *  (permissions.getAll) — permissions.contains() is unreliable on Chrome. Assume
 *  granted if the API is unavailable rather than nag. */
async function hasBroadHostAccess() {
  try {
    const { origins = [] } = await browser.permissions.getAll();
    return origins.some((o) => BROAD_HOST.has(o));
  } catch {
    return true;
  }
}

async function refresh() {
  const granted = await hasBroadHostAccess();
  grantSection.hidden = granted;
  readySection.hidden = !granted;
}

grantBtn.addEventListener('click', async () => {
  try {
    // Re-requesting a host permission listed in host_permissions shows the
    // browser's own grant prompt (needs this click's gesture).
    await browser.permissions.request({ origins: ['<all_urls>'] });
  } catch {
    /* prompt unavailable — the user can grant it from the add-on's settings */
  }
  await refresh();
});

refresh();
