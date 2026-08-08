// Onboarding page, opened once on install (see service-worker.js). Its job is to
// request host access — the grant needs a user gesture, so it can't happen in
// the install handler. On Chrome access is usually already granted at install,
// so this shows "you're all set"; on Firefox (host access is opt-in) it leads
// with the Grant button.

import { browser } from '../lib/browser.js';

const grantSection = document.getElementById('grantSection');
const readySection = document.getElementById('readySection');
const grantBtn = document.getElementById('grant');
const pinSection = document.getElementById('pinSection');
const pinHow = document.getElementById('pinHow');

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

/**
 * Ask the user to pin the toolbar icon.
 *
 * There is no way to do it for them: Chrome has had no manifest key or API for
 * this since it stopped pinning new extensions in 88, and the only mechanism
 * that can is the enterprise ExtensionSettings policy (toolbar_pin), set by an
 * administrator on managed machines. So the page asks.
 *
 * Worded per browser, told apart by the scheme of our own extension URLs — the
 * same test service-worker.js uses for file:// support. Safari is skipped
 * outright: it puts an enabled extension's button in the toolbar itself, so
 * there is nothing to ask for and the instruction would be wrong.
 */
function offerPinning() {
  const scheme = browser.runtime.getURL('');
  if (scheme.startsWith('safari-web-extension:')) return;

  pinHow.textContent = scheme.startsWith('moz-extension:')
    ? 'Open the extensions button in the toolbar, then use the gear beside Euspell → Pin to Toolbar.'
    : 'Click the extensions button (the puzzle piece) right of the address bar, then the pin beside Euspell.';
  pinSection.hidden = false;
}

offerPinning();
refresh();
