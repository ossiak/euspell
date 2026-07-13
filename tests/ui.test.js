import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flush = () => new Promise((r) => setTimeout(r, 0));

function mkEl() {
  return {
    checked: false, textContent: '', hidden: false, value: '', _on: {}, _attr: {},
    addEventListener(ev, fn) { this._on[ev] = fn; },
    setAttribute(k, v) { this._attr[k] = v; },
    async dispatch(ev) { if (this._on[ev]) await this._on[ev]({ preventDefault() {} }); },
    append() {}, replaceChildren() {},
  };
}

function makeEnv(store, tab) {
  const els = {};
  for (const id of ['enabled', 'siteRow', 'site', 'host', 'hint', 'sites', 'empty', 'addForm', 'addInput', 'options', 'viewRow', 'showOriginal', 'dictateRow', 'dictate', 'permRow', 'grant'])
    els[id] = mkEl();
  const reloaded = [];
  const document = { getElementById: (id) => els[id], createElement: () => mkEl() };
  const browser = {
    storage: {
      sync: {
        async get(keys) {
          const ks = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]]));
        },
        async set(obj) { Object.assign(store, obj); },
      },
      onChanged: { addListener() {} },
    },
    tabs: {
      async query() { return tab ? [tab] : []; },
      async reload(id) { reloaded.push(id); },
      // Mirrors real Chrome/Firefox: a message to a tab with no content script
      // REJECTS ("Could not establish connection"). store.__contentScript === true
      // simulates the script being present (it replies to the status ping).
      async sendMessage(_id, msg) {
        if (store.__contentScript && msg?.type === 'euspell:dictation:status') {
          return { active: false, supported: false };
        }
        throw new Error('Could not establish connection.');
      },
    },
    permissions: {
      // store.__hostAccess === false emulates the user revoking site access:
      // getAll then reports no granted origins (the real signal the popup uses).
      async getAll() { return { origins: store.__hostAccess === false ? [] : ['<all_urls>'] }; },
      async request() { store.__hostAccess = true; return true; },
    },
    runtime: {
      openOptionsPage() {},
      // Emulates the service worker's single-writer disabledSites handler
      // (popup/options send their edits there rather than read-modify-writing
      // storage themselves — see service-worker.js).
      async sendMessage(msg) {
        if (msg?.type === 'euspell:setSiteDisabled') {
          const set = new Set(store.disabledSites ?? []);
          if (msg.disabled) set.add(msg.host);
          else set.delete(msg.host);
          store.disabledSites = [...set];
          return { ok: true, disabledSites: store.disabledSites };
        }
        return undefined;
      },
    },
  };
  return { els, document, browser, reloaded };
}

async function runScript(relPath, env) {
  let src = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
  // These pages are ES modules that import the cross-browser `browser` shim
  // (src/lib/browser.js). We can't resolve that import inside new Function, so
  // strip it and inject the mock as `browser` — the same handle the shim exports.
  src = src.replace(/^\s*import\b.*$/gm, '');
  // eslint-disable-next-line no-new-func
  new Function('document', 'browser', 'URL', 'console', src)(env.document, env.browser, URL, console);
  await flush();
  await flush();
}

test('popup: reflects state and toggles the per-site setting', async () => {
  const store = { enabled: true, disabledSites: ['blocked.com'] };
  const env = makeEnv(store, { id: 7, url: 'https://example.com/page' });
  await runScript('../src/popup/popup.js', env);

  assert.equal(env.els.enabled.checked, true);
  assert.equal(env.els.siteRow.hidden, false);
  assert.equal(env.els.host.textContent, 'example.com');
  assert.equal(env.els.site.checked, true);

  env.els.site.checked = false;
  await env.els.site.dispatch('change');
  assert.ok(store.disabledSites.includes('example.com'));
  assert.ok(env.reloaded.includes(7));
});

test('popup: toggling global off disables the site row', async () => {
  const store = { enabled: true, disabledSites: [] };
  const env = makeEnv(store, { id: 1, url: 'https://a.com/' });
  await runScript('../src/popup/popup.js', env);
  env.els.enabled.checked = false;
  await env.els.enabled.dispatch('change');
  assert.equal(store.enabled, false);
  assert.equal(env.els.siteRow._attr['aria-disabled'], 'true');
});

test('popup: revoked host access shows the notice; granting hides it and reloads', async () => {
  const store = { enabled: true, disabledSites: [], __hostAccess: false };
  const env = makeEnv(store, { id: 4, url: 'https://a.com/' });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.permRow.hidden, false); // notice visible
  await env.els.grant.dispatch('click');
  assert.equal(store.__hostAccess, true);      // permission re-requested
  assert.equal(env.els.permRow.hidden, true);  // notice gone
  assert.ok(env.reloaded.includes(4));         // page reloaded to convert
});

test('popup: with host access granted the notice stays hidden', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [] }, { id: 5, url: 'https://a.com/' });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.permRow.hidden, true);
});

test('popup: a responding content script hides the notice even if contains() lies', async () => {
  // The Chrome bug: permissions.contains() answers false despite full access.
  // The content script replying proves access, so the notice must stay hidden.
  const store = { enabled: true, disabledSites: [], __hostAccess: false, __contentScript: true };
  const env = makeEnv(store, { id: 6, url: 'https://a.com/' });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.permRow.hidden, true);
});

test('popup: restricted pages hide the site row', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [] }, { id: 1, url: 'chrome://extensions' });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.siteRow.hidden, true);
  assert.ok(env.els.hint.textContent.length > 0);
});

test('options: adds a site, normalizing a messy URL to a bare hostname', async () => {
  const store = { enabled: true, disabledSites: ['z.com'] };
  const env = makeEnv(store, null);
  await runScript('../src/options/options.js', env);
  env.els.addInput.value = 'https://Example.COM/some/path';
  await env.els.addForm.dispatch('submit');
  assert.ok(store.disabledSites.includes('example.com'));
});

test('options: global toggle persists', async () => {
  const store = { enabled: true, disabledSites: [] };
  const env = makeEnv(store, null);
  await runScript('../src/options/options.js', env);
  env.els.enabled.checked = false;
  await env.els.enabled.dispatch('change');
  assert.equal(store.enabled, false);
});

test('popup.css: [hidden] beats the display:flex rows (else toggled-off rows still render)', () => {
  const css = fs.readFileSync(new URL('../src/popup/popup.css', import.meta.url), 'utf8');
  // A bare `.row{display:flex}` overrides the UA [hidden]{display:none}, so a
  // global [hidden]{display:none!important} is required for el.hidden to work.
  const m = css.match(/\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/i);
  assert.ok(m, 'popup.css must force [hidden] { display: none !important }');
});
