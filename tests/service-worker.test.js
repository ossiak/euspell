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
  const state = { navListeners: [], headerListeners: [], msgListeners: [], updated: [], fetches: [] };
  const browser = {
    runtime: {
      getURL: (p) => `chrome-extension://abcdefgh/${p}`,
      onInstalled: { addListener() {} },
      onMessage: { addListener: (fn) => state.msgListeners.push(fn) },
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
      },
    },
    tabs: {
      update: (tabId, props) => state.updated.push({ tabId, ...props }),
      create() {},
      async query() {
        return [];
      },
      async sendMessage() {},
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
    src,
  )(env.browser, env.fetchImpl, isPdfUrl, isPdfContentType, isPdfDisposition, isAttachmentDisposition, looksLikePdfBytes);
}

const headerDetails = (url, headers, tabId = 1) => ({
  type: 'main_frame',
  method: 'GET',
  url,
  tabId,
  responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
});

test('headers path: a pdf content-type redirects to the viewer when enabled', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [] });
  runWorker(env);
  await env.state.headerListeners[0](headerDetails('https://x.test/doc', { 'Content-Type': 'application/pdf' }));
  assert.equal(env.state.updated.length, 1);
  assert.match(env.state.updated[0].url, /viewer\.html\?file=https%3A%2F%2Fx\.test%2Fdoc$/);
  assert.equal(env.state.fetches.length, 0); // unambiguous type — no sniff needed
});

test('headers path: the sniff never fires while the extension is off', async () => {
  const env = makeEnv({ enabled: false, disabledSites: [], __pdfBytes: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 0, 'disabled extension must not issue sniff requests');
  assert.equal(env.state.updated.length, 0);
});

test('headers path: the sniff never fires for an opted-out site', async () => {
  const env = makeEnv({ enabled: true, disabledSites: ['x.test'], __pdfBytes: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 0);
  assert.equal(env.state.updated.length, 0);
});

test('headers path: an ambiguous type is sniffed when enabled, and %PDF redirects', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [], __pdfBytes: true });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 1);
  assert.equal(env.state.updated.length, 1);
});

test('headers path: an ambiguous non-PDF body is left alone', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [], __pdfBytes: false });
  runWorker(env);
  await env.state.headerListeners[0](
    headerDetails('https://x.test/download', { 'Content-Type': 'application/octet-stream' }),
  );
  assert.equal(env.state.fetches.length, 1);
  assert.equal(env.state.updated.length, 0);
});

test('headers path: an attachment download is never redirected', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [] });
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
  const env = makeEnv({ enabled: true, disabledSites: [] });
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
  const env = makeEnv({ enabled: true, disabledSites: [] });
  runWorker(env);
  const url = 'https://x.test/doc';

  sendMessage(env, { type: 'euspell:bypassOnce', url });
  await env.state.headerListeners[0](headerDetails(url, { 'Content-Type': 'application/pdf' }));
  assert.equal(env.state.updated.length, 0);

  await env.state.headerListeners[0](headerDetails(url, { 'Content-Type': 'application/pdf' }));
  assert.equal(env.state.updated.length, 1);
});

test('an unrelated message does not disturb the site-list handler', async () => {
  const env = makeEnv({ enabled: true, disabledSites: [] });
  runWorker(env);
  const res = sendMessage(env, { type: 'euspell:setSiteDisabled', host: 'x.test', disabled: true });
  // The single-writer handler responds asynchronously; wait a beat.
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(await env.browser.storage.sync.get('disabledSites'), { disabledSites: ['x.test'] });
  void res;
});
