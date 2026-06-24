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
  for (const id of ['enabled', 'siteRow', 'site', 'host', 'hint', 'sites', 'empty', 'addForm', 'addInput', 'options'])
    els[id] = mkEl();
  const reloaded = [];
  const document = { getElementById: (id) => els[id], createElement: () => mkEl() };
  const chrome = {
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
    tabs: { async query() { return tab ? [tab] : []; }, async reload(id) { reloaded.push(id); } },
    runtime: { openOptionsPage() {} },
  };
  return { els, document, chrome, reloaded };
}

async function runScript(relPath, env) {
  const src = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('document', 'chrome', 'URL', 'console', src)(env.document, env.chrome, URL, console);
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
