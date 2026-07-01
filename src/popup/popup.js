// Popup control surface. The enable/disable state lives in chrome.storage.sync
// ({ enabled, disabledSites }); changes are written there and the active tab is
// reloaded so the content script re-evaluates (it converts on load, so undoing
// a conversion needs a fresh page).

const enabledBox = document.getElementById('enabled');
const siteRow = document.getElementById('siteRow');
const siteBox = document.getElementById('site');
const hostEl = document.getElementById('host');
const hint = document.getElementById('hint');
const viewRow = document.getElementById('viewRow');
const showOriginalBox = document.getElementById('showOriginal');

/** Ask the active tab's content script for its view mode; null if not converting. */
async function tabMode(tab) {
  if (tab?.id == null) return null;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'euspell:getMode' });
    return res && res.mode ? res.mode : null;
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function load() {
  const { enabled = true, disabledSites = [] } = await chrome.storage.sync.get(['enabled', 'disabledSites']);
  const tab = await activeTab();
  const host = tab ? hostnameOf(tab) : null;

  enabledBox.checked = enabled;

  if (host) {
    hostEl.textContent = host;
    siteBox.checked = !disabledSites.includes(host);
    siteRow.hidden = false;
    siteRow.setAttribute('aria-disabled', String(!enabled));
  } else {
    siteRow.hidden = true;
    hint.textContent = 'This page can’t be converted.';
  }

  // Live view toggle: only shown when this tab is actually converting.
  const mode = await tabMode(tab);
  if (mode) {
    showOriginalBox.checked = mode === 'original';
    viewRow.hidden = false;
  } else {
    viewRow.hidden = true;
  }
}

showOriginalBox.addEventListener('change', async () => {
  const tab = await activeTab();
  if (tab?.id == null) return;
  const mode = showOriginalBox.checked ? 'original' : 'euspell';
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'euspell:setMode', mode });
  } catch {
    viewRow.hidden = true; // page stopped converting
  }
});

/** Reload the active tab so the new setting takes effect. */
async function applyAndReload() {
  const tab = await activeTab();
  if (tab?.id != null) await chrome.tabs.reload(tab.id);
  hint.textContent = 'Reloading…';
}

enabledBox.addEventListener('change', async () => {
  await chrome.storage.sync.set({ enabled: enabledBox.checked });
  siteRow.setAttribute('aria-disabled', String(!enabledBox.checked));
  await applyAndReload();
});

siteBox.addEventListener('change', async () => {
  const tab = await activeTab();
  const host = tab ? hostnameOf(tab) : null;
  if (!host) return;
  const { disabledSites = [] } = await chrome.storage.sync.get('disabledSites');
  const set = new Set(disabledSites);
  if (siteBox.checked) set.delete(host);
  else set.add(host);
  await chrome.storage.sync.set({ disabledSites: [...set] });
  await applyAndReload();
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

load();
