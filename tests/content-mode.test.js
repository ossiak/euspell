// Content-script wiring, in two parts.
//
// View mode: settings changes (storage.onChanged) must flip conversion live in
// EVERY tab — the popup's setMode message reaches only the active tab, and the
// options page sends no messages at all.
//
// Startup: the script's listeners must all be in place before it does anything
// asynchronous, and must be in place even on a document it cannot convert.
// Silence in response to a ping is how the service worker decides a tab needs
// injecting, so a script that is merely still starting up (or is running on a
// body-less SVG/XML document) gets a SECOND copy injected on top of it.
//
// Runs the real content.js source with its imports stripped and spies injected,
// the same way ui.test.js runs the popup/options scripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * @param {object} store  the fake storage.sync contents
 * @param {{ hostname?: string, body?: boolean, deferReads?: boolean }} opts
 *   body: false emulates an SVG/XML document, which has no <body>.
 *   deferReads: true holds every storage read open until releaseReads() is
 *   called, so a test can inspect the script mid-startup.
 */
function makeEnv(store, { hostname = 'x.test', body = true, deferReads = false } = {}) {
  const state = { converted: 0, restored: 0, onChanged: [], onMessage: [], pendingReads: [] };
  const browser = {
    storage: {
      sync: {
        get(keys) {
          const ks = Array.isArray(keys) ? keys : [keys];
          const value = Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]]));
          if (!deferReads) return Promise.resolve(value);
          return new Promise((resolve) => state.pendingReads.push(() => resolve(value)));
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
    document: body ? { body: {} } : {},
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

/** Load and run the script. Returns before any awaited work has settled. */
function loadContentScript(env) {
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
}

async function runContentScript(env) {
  loadContentScript(env);
  await flush();
  await flush();
}

/**
 * Deliver a message the way the service worker or popup would. `reply` is a
 * getter, not a snapshot: a listener that returns true answers later, and the
 * caller has to be able to read that answer after flushing.
 */
function sendMessage(env, msg) {
  let answer;
  const handled = env.state.onMessage.map((fn) => fn(msg, null, (r) => { answer = r; }));
  return { handled, get reply() { return answer; } };
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

test('the ping is answered before the first storage read has settled', async () => {
  // The startup race. The script used to read the setting BEFORE registering its
  // listeners, so a ping arriving in that window went unanswered — and the
  // worker reads silence as "no content script here" and injects another copy on
  // top of the one still starting.
  const env = makeEnv({ enabled: true }, { deferReads: true });
  loadContentScript(env); // synchronous; the storage read is still open

  assert.ok(env.state.pendingReads.length > 0, 'the setting read really is outstanding');
  const { reply } = sendMessage(env, { type: 'euspell:ping' });
  assert.deepEqual(reply, { alive: true }, 'a starting script must still claim the page');

  for (const release of env.state.pendingReads) release();
  await flush();
  await flush();
  assert.equal(env.state.converted, 1, 'and it goes on to convert as normal');
});

test('a document with no <body> still answers the ping', async () => {
  // <all_urls> matches SVG/XML documents. There is nothing to convert there, but
  // the script IS running — it has wired up dictation — so it must say so.
  // Returning early instead left every such tab looking script-less, earning it
  // a fresh injection on every install, update and unpacked reload, each one
  // stacking another dictation listener in the isolated world.
  const env = makeEnv({ enabled: true }, { body: false });
  await runContentScript(env);

  const { reply } = sendMessage(env, { type: 'euspell:ping' });
  assert.deepEqual(reply, { alive: true });
  assert.equal(env.state.converted, 0, 'but there is nothing to convert');
});

test('a document with no <body> never fetches the lexicon', async () => {
  // A walk it cannot perform must not cost the 12.8 MB table either.
  const env = makeEnv({ enabled: true }, { body: false });
  let loads = 0;
  env.ensureLexicon = async () => {
    loads++;
  };
  await runContentScript(env);
  assert.equal(loads, 0);

  await changeSettings(env, { enabled: true }, { enabled: true });
  assert.equal(loads, 0, 'and a later toggle does not change that');
});

test('a setMode message on a body-less document is answered, not left hanging', async () => {
  // The popup awaits this reply. applyMode stops short of converting, but it
  // must still resolve or the popup's send never settles.
  const env = makeEnv({ enabled: true }, { body: false });
  await runContentScript(env);

  const sent = sendMessage(env, { type: 'euspell:setMode', mode: 'euspell' });
  assert.ok(sent.handled.includes(true), 'the listener must keep the channel open for an async reply');
  await flush();
  await flush();
  assert.deepEqual(sent.reply, { mode: 'original' }, 'honestly reporting that it did not convert');
});

test('the dictation listener is installed exactly once per injection', async () => {
  // initDictation registers a message listener and a focusin listener, so a
  // second copy of the script on one page means every toggle is handled twice.
  // The ping is what stops the worker injecting that second copy; this pins the
  // other half — that one load wires it up once.
  const env = makeEnv({ enabled: true });
  let inits = 0;
  env.initDictation = () => {
    inits++;
  };
  await runContentScript(env);
  assert.equal(inits, 1);
});

test('non-sync storage areas are ignored', async () => {
  const store = { enabled: true };
  const env = makeEnv(store);
  await runContentScript(env);

  for (const fn of env.state.onChanged) await fn({ enabled: { newValue: false } }, 'local');
  await flush();
  assert.equal(env.state.restored, 0);
});
