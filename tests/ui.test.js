import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPdfUrl, canViewFileUrls } from '../src/pdf/pdf-url.js';

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

// The extension URL scheme the page sees, which is how a build tells which
// browser it is running on: Chrome/Chromium chrome-extension:, Firefox
// moz-extension:, Safari safari-web-extension:. The popup reads it to decide
// whether local PDFs can reach our viewer at all.
function makeEnv(store, tab, { scheme = 'chrome-extension' } = {}) {
  const els = {};
  for (const id of ['enabled', 'hint', 'options', 'dictateRow', 'dictate', 'grant', 'accessHint',
    'reloadRow', 'reload'])
    els[id] = mkEl();
  const reloaded = [];
  // Every icon repaint the page asks for, so a test can assert the popup gives
  // immediate feedback rather than leaving it to the service worker.
  const painted = [];
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
      getURL: (p) => `${scheme}://abcdefgh/${p}`,
      openOptionsPage() {},
      async sendMessage() { return undefined; },
    },
  };
  return { els, document, browser, reloaded, painted };
}

async function runScript(relPath, env) {
  let src = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
  // These pages are ES modules that import the cross-browser `browser` shim
  // (src/lib/browser.js). We can't resolve that import inside new Function, so
  // strip it and inject the mock as `browser` — the same handle the shim exports.
  src = src.replace(/^\s*import\b.*$/gm, '');
  // eslint-disable-next-line no-new-func
  new Function(
    'document', 'browser', 'URL', 'console', 'paintActionIcon',
    'isPdfUrl', 'canViewFileUrls', 'window', src,
  )(
    env.document, env.browser, URL, console,
    async (on) => { env.painted.push(on); },
    // The real predicates, so the popup's offer can't drift from the worker's
    // redirect — the two used to test file:// support separately and disagreed.
    isPdfUrl, canViewFileUrls,
    { close() {} },
  );
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
  // The popup repaints the toolbar itself. Leaving that to the service worker's
  // storage.onChanged means the icon lags behind the click by a worker wake-up,
  // and shows nothing at all if the worker fails to start.
  assert.deepEqual(env.painted, [false]);
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

// The hand-off to our PDF viewer is a navigation-time redirect, so a PDF opened
// while Euspell was off stays in the browser's own viewer — which no extension
// can reach — until the tab navigates again. The popup offers the reload rather
// than performing it uninvited.
test('popup: offers a reload for a PDF the browser is rendering itself', async () => {
  const env = makeEnv({ enabled: true }, { id: 5, url: 'https://x.test/paper.pdf' });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.reloadRow.hidden, false);

  await env.els.reload.dispatch('click');
  assert.deepEqual(env.reloaded, [5], 'reloading re-navigates, which is what the worker redirects on');
});

test('popup: our own PDF viewer is neither unconvertible nor in need of a reload', async () => {
  // The viewer is a chrome-extension:// page, so a bare protocol test would call
  // the one tab that is nothing BUT conversion "can't be converted" — and it
  // follows the switch live, so the hint would be doubly wrong.
  const url = 'chrome-extension://abcdefgh/src/pdf/viewer.html?file=https%3A%2F%2Fx.test%2Fp.pdf';
  const env = makeEnv({ enabled: true }, { id: 5, url });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.reloadRow.hidden, true, 'already ours — nothing to hand over');
  assert.equal(env.els.hint.textContent, '', 'and it certainly can be converted');
});

test('popup: no reload offer while conversion is off, or on a non-PDF', async () => {
  // Off: the native viewer is showing exactly what was asked for.
  const off = makeEnv({ enabled: false }, { id: 5, url: 'https://x.test/paper.pdf' });
  await runScript('../src/popup/popup.js', off);
  assert.equal(off.els.reloadRow.hidden, true);

  const page = makeEnv({ enabled: true }, { id: 5, url: 'https://x.test/article' });
  await runScript('../src/popup/popup.js', page);
  assert.equal(page.els.reloadRow.hidden, true);
});

// A local PDF is the one case where the offer depends on the BROWSER, not the
// URL: Firefox and Safari extension pages may not fetch file://, so the worker
// deliberately leaves those to the native viewer. The popup must reach the same
// conclusion — it once tested only for Firefox, so on Safari it offered a reload
// the worker then declined to act on, and the offer returned after every reload.
test('popup: a local PDF earns a reload offer only where the viewer could fetch it', async () => {
  const local = 'file:///home/me/paper.pdf';
  for (const [scheme, offered] of [
    ['chrome-extension', true],
    ['moz-extension', false],
    ['safari-web-extension', false],
  ]) {
    const env = makeEnv({ enabled: true }, { id: 5, url: local }, { scheme });
    await runScript('../src/popup/popup.js', env);
    assert.equal(
      env.els.reloadRow.hidden,
      !offered,
      `${scheme}: reload offer should be ${offered ? 'shown' : 'hidden'} for a file:// PDF`,
    );
  }
});

test('popup and worker decide file:// support with the same shared predicate', () => {
  // Two copies of this test drifted once already. Neither surface may re-derive
  // it from the URL scheme on its own.
  const popup = fs.readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
  const worker = fs.readFileSync(new URL('../src/background/service-worker.js', import.meta.url), 'utf8');
  for (const [name, src] of [['popup.js', popup], ['service-worker.js', worker]]) {
    assert.match(src, /canViewFileUrls\(/, `${name} must use the shared predicate`);
    assert.ok(
      !/startsWith\('(moz|safari)-/.test(src),
      `${name} must not test the extension scheme itself`,
    );
  }
});

test('popup: turning conversion on over a native PDF reveals the offer', async () => {
  const store = { enabled: false };
  const env = makeEnv(store, { id: 5, url: 'https://x.test/paper.pdf' });
  await runScript('../src/popup/popup.js', env);
  assert.equal(env.els.reloadRow.hidden, true);

  env.els.enabled.checked = true;
  await env.els.enabled.dispatch('change');
  assert.equal(env.els.reloadRow.hidden, false, 'the offer must appear without reopening the popup');
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

test('options: the Convert pages toggle persists and repaints the icon', async () => {
  const store = { enabled: true };
  const env = makeEnv(store, null);
  await runScript('../src/options/options.js', env);
  env.els.enabled.checked = false;
  await env.els.enabled.dispatch('change');
  assert.equal(store.enabled, false);
  assert.deepEqual(env.painted, [false]);
});

test('popup.css: [hidden] beats the display:flex rows (else toggled-off rows still render)', () => {
  const css = fs.readFileSync(new URL('../src/popup/popup.css', import.meta.url), 'utf8');
  // A bare `.row{display:flex}` overrides the UA [hidden]{display:none}, so a
  // global [hidden]{display:none!important} is required for el.hidden to work.
  const m = css.match(/\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/i);
  assert.ok(m, 'popup.css must force [hidden] { display: none !important }');
});
