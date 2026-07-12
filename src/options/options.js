// Options page. Mirrors the same browser.storage.sync state the popup uses
// ({ enabled, disabledSites }) and stays in sync live via storage.onChanged.

import { browser } from '../lib/browser.js';

const enabledBox = document.getElementById('enabled');
const sitesList = document.getElementById('sites');
const emptyMsg = document.getElementById('empty');
const addForm = document.getElementById('addForm');
const addInput = document.getElementById('addInput');

/** Normalize user input to a bare hostname ("https://Ex.com/x" -> "ex.com"). */
function normalizeHost(value) {
  let v = value.trim().toLowerCase();
  if (!v) return null;
  try {
    if (!/^[a-z]+:\/\//.test(v)) v = 'http://' + v;
    return new URL(v).hostname || null;
  } catch {
    return null;
  }
}

async function getState() {
  return browser.storage.sync.get(['enabled', 'disabledSites']);
}

function render({ enabled = true, disabledSites = [] }) {
  enabledBox.checked = enabled;

  sitesList.replaceChildren();
  const sorted = [...disabledSites].sort();
  emptyMsg.hidden = sorted.length > 0;

  for (const host of sorted) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = host;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => setSiteDisabled(host, false));
    li.append(name, remove);
    sitesList.append(li);
  }
}

// All disabledSites edits go through the service worker — the single writer —
// so an edit here can't interleave with one from the popup and drop it. The
// storage.onChanged listener below re-renders once the write lands.
function setSiteDisabled(host, disabled) {
  return browser.runtime.sendMessage({ type: 'euspell:setSiteDisabled', host, disabled });
}

enabledBox.addEventListener('change', () => {
  browser.storage.sync.set({ enabled: enabledBox.checked });
});

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const host = normalizeHost(addInput.value);
  if (!host) return;
  await setSiteDisabled(host, true); // the worker's Set dedupes a repeat add
  addInput.value = '';
});

// Keep the page current if the popup (or another options tab) changes settings.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && ('enabled' in changes || 'disabledSites' in changes)) {
    getState().then(render);
  }
});

getState().then(render);
