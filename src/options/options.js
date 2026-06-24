// Options page. Mirrors the same chrome.storage.sync state the popup uses
// ({ enabled, disabledSites }) and stays in sync live via storage.onChanged.

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
  return chrome.storage.sync.get(['enabled', 'disabledSites']);
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
    remove.addEventListener('click', () => removeSite(host));
    li.append(name, remove);
    sitesList.append(li);
  }
}

async function removeSite(host) {
  const { disabledSites = [] } = await chrome.storage.sync.get('disabledSites');
  await chrome.storage.sync.set({ disabledSites: disabledSites.filter((h) => h !== host) });
}

enabledBox.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledBox.checked });
});

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const host = normalizeHost(addInput.value);
  if (!host) return;
  const { disabledSites = [] } = await chrome.storage.sync.get('disabledSites');
  if (!disabledSites.includes(host)) {
    await chrome.storage.sync.set({ disabledSites: [...disabledSites, host] });
  }
  addInput.value = '';
});

// Keep the page current if the popup (or another options tab) changes settings.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && ('enabled' in changes || 'disabledSites' in changes)) {
    getState().then(render);
  }
});

getState().then(render);
