// Service-worker behavior around the PDF redirect: settings gate the sniff
// request, and the viewer's "Open original" arming lets exactly one navigation
// through un-redirected. Runs the real service-worker.js source with the
// imports stripped and mocks injected, the same way ui.test.js runs the
// popup/options scripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isPdfUrl,
  isPdfContentType,
  isPdfDisposition,
  isAttachmentDisposition,
  looksLikePdfBytes,
} from '../src/pdf/pdf-url.js';

function makeEnv(store) {
  const state = {
    navListeners: [], headerListeners: [], msgListeners: [], updated: [], fetches: [],
    // Toolbar-icon calls, so a test can assert which artwork the worker painted.
    icons: [], titles: [], installListeners: [], startupListeners: [], changeListeners: [],
    // Re-injection bookkeeping: what was pinged, and what was executed where.
    pings: [], injected: [],
  };
  const browser = {
    runtime: {
      getURL: (p) => `chrome-extension://abcdefgh/${p}`,
      onInstalled: { addListener: (fn) => state.installListeners.push(fn) },
      onStartup: { addListener: (fn) => state.startupListeners.push(fn) },
      onMessage: { addListener: (fn) => state.msgListeners.push(fn) },
    },
    action: {
      async setIcon({ path }) { state.icons.push(path); },
      async setTitle({ title }) { state.titles.push(title); },
    },
    storage: {
      sync: {
        async get(keys) {
          const ks = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]]));
        },
        async set(obj) {
          Object.assign(store, obj);
        },
        async remove(key) { delete store[key]; },
      },
      onChanged: { addListener: (fn) => state.changeListeners.push(fn) },
    },
    tabs: {
      update: (tabId, props) => state.updated.push({ tabId, ...props }),
      create() {},
      async query() {
        return store.__tabs ?? [];
      },
      async sendMessage(tabId, msg) {
        state.pings.push({ tabId, type: msg?.type });
        if (msg?.type === 'euspell:ping') {
          // Only tabs listed alive answer; the rest reject the way Chrome does
          // when there is no receiver (no script, or one orphaned by a reload).
          if (store.__alive?.includes(tabId)) return { alive: true };
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        return undefined;
      },
    },
    scripting: {
      async executeScript({ target, files }) {
        if (store.__restricted?.includes(target.tabId)) {
          throw new Error('Cannot access contents of the page');
        }
        // `func` is not invoked: it dereferences `window`, which does not exist
        // here. What matters is that the clear is ordered before the bundle.
        state.injected.push({ tabId: target.tabId, what: files ? files[0] : 'clear-owner' });
        return [];
      },
    },
    commands: { onCommand: { addListener() {} } },
    webNavigation: { onBeforeNavigate: { addListener: (fn) => state.navListeners.push(fn) } },
    webRequest: { onHeadersReceived: { addListener: (fn) => state.headerListeners.push(fn) } },
  };
  // The sniff fetch: serves %PDF bytes when store.__pdfBytes, junk otherwise.
  const fetchImpl = async (url) => {
    state.fetches.push(url);
    const body = store.__pdfBytes ? '%PDF-1.7 junk' : 'not a pdf at all';
    return {
      ok: true,
      status: 200,
      body: null, // exercise the arrayBuffer path
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    };
  };
  return { browser, state, fetchImpl };
}

function runWorker(env) {
  let src = fs.readFileSync(new URL('../src/background/service-worker.js', import.meta.url), 'utf8');
  // Strip the (multi-line) import statements; the imported pdf-url helpers are
  // injected as function parameters instead — the real implementations.
  src = src.replace(/^import[\s\S]*?from\s*'[^']+';/gm, '');
  // eslint-disable-next-line no-new-func
  new Function(
    'browser', 'fetch',
    'isPdfUrl', 'isPdfContentType', 'isPdfDisposition', 'isAttachmentDisposition', 'looksLikePdfBytes',
    'paintActionIcon', 'refreshActionIcon',
    src,
  )(
    env.browser, env.fetchImpl,
    isPdfUrl, isPdfContentType, isPdfDisposition, isAttachmentDisposition, looksLikePdfBytes,
    // Spies for the shared icon module (tested for real in action-icon.test.js):
    // here we only care that the worker asks for the right state.
    async (on) => { env.state.icons.push(on); },
    async () => { env.state.icons.push((await env.browser.storage.sync.get('enabled')).enabled ?? true); },
  );
}

const headerDetails = (url, headers, opts = {}) => ({
  type: opts.type ?? 'main_frame',
  method: 'GET',
  url,
  tabId: opts.tabId ?? 1,
  // -1 for the main frame; a real frame id for a sub_frame (0 == child of the
  // main frame, which is the only sub_frame depth the worker acts on).
  parentFrameId: opts.parentFrameId ?? -1,
  responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
});

test('headers path: a pdf content-type redirects to the viewer when enabled', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.headerListeners[0](headerDetails('https://x.test/doc', { 'Content-Type': 'application/pdf' }));
  assert.equal(env.state.updated.length, 1);
  assert.match(env.state.updated[0].url, /viewer\.html\?file=https%3A%2F%2Fx\.test%2Fdoc$/);
  assert.equal(env.state.fetches.length, 0); // unambiguous type — no sniff needed
});

test('headers path: the sniff never fires while the extension is off', async () => {
  const env = makeEnv({ enabled: false, __pdfBytes: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 0, 'disabled extension must not issue sniff requests');
  assert.equal(env.state.updated.length, 0);
});

test('headers path: an ambiguous type is sniffed when enabled, and %PDF redirects', async () => {
  const env = makeEnv({ enabled: true, __pdfBytes: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 1);
  assert.equal(env.state.updated.length, 1);
});

test('headers path: an ambiguous non-PDF body is left alone', async () => {
  const env = makeEnv({ enabled: true, __pdfBytes: false });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 1);
  assert.equal(env.state.updated.length, 0);
});

test('headers path: a PDF in a first-level iframe promotes the whole tab', async () => {
  // The wrapper-page shape: an HTML page whose body is one <iframe> holding an
  // extensionless PDF. We can't touch a framed PDF, so the whole tab is sent to
  // the viewer on the frame's own URL.
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/announcement/asx/abc', { 'Content-Type': 'application/pdf' },
      { type: 'sub_frame', parentFrameId: 0, tabId: 7 }),
  );
  assert.equal(env.state.updated.length, 1);
  assert.equal(env.state.updated[0].tabId, 7, 'navigates the whole tab, not just the frame');
  assert.match(
    env.state.updated[0].url,
    /viewer\.html\?file=https%3A%2F%2Fx\.test%2Fannouncement%2Fasx%2Fabc$/,
  );
});

test('headers path: a PDF in a deeply-nested frame is left alone', async () => {
  // Guard against a deep ad/tracking frame that serves a PDF hijacking the tab.
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://ads.test/banner', { 'Content-Type': 'application/pdf' },
      { type: 'sub_frame', parentFrameId: 9 }),
  );
  assert.equal(env.state.updated.length, 0, 'only direct children of the main frame promote');
});

test('headers path: an attachment download is never redirected', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/report', {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="report.pdf"',
    }),
  );
  assert.equal(env.state.updated.length, 0);
});

/** Deliver a message to every registered onMessage listener (as the browser does). */
function sendMessage(env, msg) {
  let response;
  for (const fn of env.state.msgListeners) fn(msg, {}, (r) => { response = r; });
  return response;
}

test('bypass arming lets exactly one navigation through the .pdf redirect', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  const url = 'https://x.test/paper.pdf';

  const res = sendMessage(env, { type: 'euspell:bypassOnce', url });
  assert.deepEqual(res, { ok: true });

  await env.state.navListeners[0]({ frameId: 0, url, tabId: 2 });
  assert.equal(env.state.updated.length, 0, 'armed navigation must pass through');

  await env.state.navListeners[0]({ frameId: 0, url, tabId: 2 });
  assert.equal(env.state.updated.length, 1, 'the arming is one-shot');
});

test('bypass arming also covers the extensionless headers path', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  const url = 'https://x.test/doc';

  sendMessage(env, { type: 'euspell:bypassOnce', url });
  await env.state.headerListeners[0](headerDetails(url, { 'Content-Type': 'application/pdf' }));
  assert.equal(env.state.updated.length, 0);

  await env.state.headerListeners[0](headerDetails(url, { 'Content-Type': 'application/pdf' }));
  assert.equal(env.state.updated.length, 1);
});

const settle = () => new Promise((r) => setTimeout(r, 0));

test('the worker paints the icon from the setting on wake-up', async () => {
  const on = makeEnv({ enabled: true });
  runWorker(on);
  await settle();
  assert.equal(on.state.icons.at(-1), true);

  const off = makeEnv({ enabled: false });
  runWorker(off);
  await settle();
  assert.equal(off.state.icons.at(-1), false);
});

test('a setting change from any surface repaints the icon', async () => {
  // This is the path that serves the options page and other synced devices; the
  // popup paints for itself so its feedback never waits on this worker waking.
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await settle();

  for (const fn of env.state.changeListeners) fn({ enabled: { newValue: false } }, 'sync');
  await settle();
  assert.equal(env.state.icons.at(-1), false);

  for (const fn of env.state.changeListeners) fn({ enabled: { newValue: true } }, 'sync');
  await settle();
  assert.equal(env.state.icons.at(-1), true);
});

test('a change to an unrelated key leaves the icon alone', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await settle();
  const before = env.state.icons.length;
  for (const fn of env.state.changeListeners) fn({ somethingElse: { newValue: 1 } }, 'sync');
  await settle();
  assert.equal(env.state.icons.length, before);
});

test('install drops the retired per-site list and seeds the one setting', async () => {
  // A profile upgrading from the per-site build still carries disabledSites in
  // synced storage; nothing reads it any more, so it is removed rather than left
  // to sync between devices forever.
  const store = { enabled: false, disabledSites: ['old.example'] };
  const env = makeEnv(store);
  runWorker(env);
  await env.state.installListeners[0]({ reason: 'update' });
  assert.equal('disabledSites' in store, false, 'the stale key must be removed');
  assert.equal(store.enabled, false, 'an existing choice is preserved');
  assert.equal(env.state.icons.at(-1), false, 'and the icon matches it');
});

// --- re-injection after an extension reload ---------------------------------
// Declarative content_scripts run only at page load, so reloading or updating
// the extension leaves open tabs with an orphaned script and no conversion until
// the user reloads each tab. The worker injects into those tabs itself.

const openTabs = (...ids) => ids.map((id) => ({ id, url: 'https://site' + id + '.example/' }));

test('reload injects into a tab whose script is orphaned', async () => {
  const store = { enabled: true, __tabs: openTabs(1), __alive: [] };
  const env = makeEnv(store);
  runWorker(env);
  await env.state.installListeners[0]({ reason: 'update' });

  assert.deepEqual(env.state.pings, [{ tabId: 1, type: 'euspell:ping' }]);
  assert.deepEqual(
    env.state.injected,
    [{ tabId: 1, what: 'clear-owner' }, { tabId: 1, what: 'dist/content-bundle.js' }],
  );
});

test('the previous owner is cleared BEFORE the bundle is injected', async () => {
  // The bundle returns early on a page that is already claimed, and an orphan's
  // claim outlives it in the isolated world. Injecting first and clearing second
  // would be a silent no-op -- exactly the bug this fixes.
  const store = { enabled: true, __tabs: openTabs(7), __alive: [] };
  const env = makeEnv(store);
  runWorker(env);
  await env.state.installListeners[0]({ reason: 'update' });

  const order = env.state.injected.filter((i) => i.tabId === 7).map((i) => i.what);
  assert.deepEqual(order, ['clear-owner', 'dist/content-bundle.js']);
});

test('a tab with a live script is left alone', async () => {
  // Injecting a second copy over a working one would double-convert the page.
  const store = { enabled: true, __tabs: openTabs(1, 2), __alive: [2] };
  const env = makeEnv(store);
  runWorker(env);
  await env.state.installListeners[0]({ reason: 'update' });

  assert.deepEqual(env.state.injected.map((i) => i.tabId), [1, 1], 'only tab 1 is injected');
});

test('a restricted tab is skipped without throwing', async () => {
  // chrome://, the Web Store and other extensions' pages reject executeScript.
  // One unreachable tab must not abort the sweep over the rest.
  const store = { enabled: true, __tabs: openTabs(1, 2), __alive: [], __restricted: [1] };
  const env = makeEnv(store);
  runWorker(env);
  await env.state.installListeners[0]({ reason: 'update' });

  assert.deepEqual(env.state.injected.map((i) => i.tabId), [2, 2], 'tab 2 still gets injected');
});

// `euspell=off` in the query string is the PDF counterpart of the DOM's
// data-euspell="off": the euspell white paper is served this way so the viewer
// never reforms the traditional spellings it quotes.
test('nav path: a pdf linked with euspell=off is left to the browser', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.navListeners[0]({ frameId: 0, url: 'https://euspell.org/paper.pdf?euspell=off', tabId: 2 });
  assert.equal(env.state.updated.length, 0, 'opted-out PDF must not reach the viewer');

  // The same file without the marker still converts, so the opt-out is doing the work.
  await env.state.navListeners[0]({ frameId: 0, url: 'https://euspell.org/paper.pdf', tabId: 2 });
  assert.equal(env.state.updated.length, 1);
});

test('headers path: euspell=off also blocks an extensionless pdf', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://euspell.org/paper?euspell=off', { 'Content-Type': 'application/pdf' }),
  );
  assert.equal(env.state.updated.length, 0);
  assert.equal(env.state.fetches.length, 0, 'and no sniff request is made for it');
});

test('an unrelated euspell query value does not opt out', async () => {
  const env = makeEnv({ enabled: true });
  runWorker(env);
  await env.state.navListeners[0]({ frameId: 0, url: 'https://x.test/doc.pdf?euspell=on', tabId: 2 });
  assert.equal(env.state.updated.length, 1);
});
