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
  for (const id of ['enabled', 'hint', 'options', 'dictateRow', 'dictate', 'grant', 'accessHint'])
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
      async sendMessage() { return undefined; },
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

test('popup: reflects the setting and toggles it live (no reload)', async () => {
  const store = { enabled: true };
  const env = makeEnv(store, { id: 7, url: 'https://example.com/page' });
  await runScript('../src/popup/popup.js', env);

  assert.equal(env.els.enabled.checked, true);
  assert.equal(env.els.hint.textContent, ''); // a convertible page needs no hint

  env.els.enabled.checked = false;
  await env.els.enabled.dispatch('change');
  assert.equal(store.enabled, false);      // persisted
  assert.equal(env.reloaded.length, 0);    // switched live, not reloaded
});

test('popup: the switch is global, so it stays usable on a restricted page', async () => {
  // There is no per-site control any more, so a chrome:// tab only earns an
  // explanatory hint — the switch itself must still work, since it governs
  // every other tab.
  const store = { enabled: true };
  const env = makeEnv(store, { id: 1, url: 'chrome://extensions' });
  await runScript('../src/popup/popup.js', env);
  assert.ok(env.els.hint.textContent.length > 0);
  env.els.enabled.checked = false;
  await env.els.enabled.dispatch('change');
  assert.equal(store.enabled, false);
});

test('options: offers the grant button when host access is missing; granting hides it', async () => {
  const store = { enabled: true, __hostAccess: false };
  const env = makeEnv(store, null);
  await runScript('../src/options/options.js', env);
  assert.equal(env.els.grant.hidden, false);   // grant offered
  await env.els.grant.dispatch('click');
  assert.equal(store.__hostAccess, true);       // permission requested
  assert.equal(env.els.grant.hidden, true);     // grant hidden once granted
});

test('options: with host access granted the grant button stays hidden', async () => {
  const env = makeEnv({ enabled: true }, null);
  await runScript('../src/options/options.js', env);
  assert.equal(env.els.grant.hidden, true);
});

test('options: the Convert pages toggle persists', async () => {
  const store = { enabled: true };
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
