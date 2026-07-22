// Content-script view-mode wiring: settings changes (storage.onChanged) must
// flip conversion live in EVERY tab — the popup's setMode message reaches only
// the active tab, and the options page sends no messages at all. Runs the real
// content.js source with its imports stripped and spies injected, the same way
// ui.test.js runs the popup/options scripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeEnv(store, { hostname = 'x.test' } = {}) {
  const state = { converted: 0, restored: 0, onChanged: [], onMessage: [] };
  const browser = {
    storage: {
      sync: {
        async get(keys) {
          const ks = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]]));
        },
      },
      onChanged: { addListener: (fn) => state.onChanged.push(fn) },
    },
    runtime: {
      id: 'abcdefgh',
      onMessage: { addListener: (fn) => state.onMessage.push(fn) },
    },
  };
  const env = {
    state,
    browser,
    window: {},
    document: { body: {} },
    location: { hostname },
    addEventListener() {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    setInterval: () => 0, // the orphan lifecheck must not keep the test alive
    clearInterval() {},
    // Injected in place of the stripped imports:
    convert: (w) => w,
    walkTextNodes: () => {
      state.converted++;
    },
    restoreOriginals: () => {
      state.restored++;
    },
    createRateGuard: () => () => true,
    initDictation() {},
    ensureLexicon: async () => {},
  };
  return env;
}

async function runContentScript(env) {
  let src = fs.readFileSync(new URL('../src/content/content.js', import.meta.url), 'utf8');
  src = src.replace(/^\s*import\b.*$/gm, '');
  // eslint-disable-next-line no-new-func
  new Function(
    'browser', 'window', 'document', 'location', 'addEventListener',
    'MutationObserver', 'Node', 'setInterval', 'clearInterval',
    'convert', 'walkTextNodes', 'restoreOriginals', 'createRateGuard', 'initDictation', 'ensureLexicon',
    src,
  )(
    env.browser, env.window, env.document, env.location, env.addEventListener,
    env.MutationObserver, env.Node, env.setInterval, env.clearInterval,
    env.convert, env.walkTextNodes, env.restoreOriginals, env.createRateGuard, env.initDictation, env.ensureLexicon,
  );
  await flush();
  await flush();
}

/** Mutate the store and fire storage.onChanged the way the browser would. */
async function changeSettings(env, store, patch) {
  const changes = {};
  for (const [k, v] of Object.entries(patch)) {
    changes[k] = { oldValue: store[k], newValue: v };
    store[k] = v;
  }
  for (const fn of env.state.onChanged) await fn(changes, 'sync');
  await flush();
}

test('a global toggle-off restores a background tab (no message needed)', async () => {
  const store = { enabled: true };
  const env = makeEnv(store);
  await runContentScript(env);
  assert.equal(env.state.converted, 1, 'page converts on load');

  await changeSettings(env, store, { enabled: false });
  assert.equal(env.state.restored, 1, 'storage change alone must restore the page');

  await changeSettings(env, store, { enabled: true });
  assert.equal(env.state.converted, 2, 'toggling back on reconverts live');
});

test('a change to an unrelated key leaves this tab alone', async () => {
  const store = { enabled: true };
  const env = makeEnv(store);
  await runContentScript(env);
  assert.equal(env.state.converted, 1);

  await changeSettings(env, store, { someOtherSetting: 1 });
  assert.equal(env.state.restored, 0, 'an unrelated change must not restore');
  assert.equal(env.state.converted, 1, 'and must not reconvert');
});

test('a page loaded while disabled converts when enabled later', async () => {
  const store = { enabled: false };
  const env = makeEnv(store);
  await runContentScript(env);
  assert.equal(env.state.converted, 0, 'disabled at load — no conversion');

  await changeSettings(env, store, { enabled: true });
  assert.equal(env.state.converted, 1);
});

test('a lexicon failure leaves the page alone but keeps every listener alive', async () => {
  const store = { enabled: true };
  const env = makeEnv(store);
  let fail = true;
  env.ensureLexicon = async () => {
    if (fail) throw new Error('offline');
  };
  await runContentScript(env);
  assert.equal(env.state.converted, 0, 'no conversion without the lexicon');
  assert.ok(env.state.onChanged.length > 0, 'settings listener still registered');
  assert.ok(env.state.onMessage.length > 0, 'message listeners still registered');

  fail = false; // the fetch works next time (ensureLexicon retries after failure)
  await changeSettings(env, store, { enabled: false });
  await changeSettings(env, store, { enabled: true });
  assert.equal(env.state.converted, 1, 'a later toggle retries the load and converts');
});

test('the lexicon is never fetched for a page that does not convert', async () => {
  const store = { enabled: false };
  const env = makeEnv(store);
  let loads = 0;
  env.ensureLexicon = async () => {
    loads++;
  };
  await runContentScript(env);
  assert.equal(loads, 0, 'a page that will not convert must not pay the lexicon load');
  assert.equal(env.state.converted, 0);

  await changeSettings(env, store, { enabled: true });
  assert.equal(loads, 1, 'turning it on loads the lexicon on demand');
  assert.equal(env.state.converted, 1);
});

test('non-sync storage areas are ignored', async () => {
  const store = { enabled: true };
  const env = makeEnv(store);
  await runContentScript(env);

  for (const fn of env.state.onChanged) await fn({ enabled: { newValue: false } }, 'local');
  await flush();
  assert.equal(env.state.restored, 0);
});
