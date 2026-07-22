// The PDF viewer's host seam. viewer.js is written against one API; the
// extension gets src/pdf/host.js and the Eupub/Android build gets
// host.mobile.js via a rollup alias. Nothing at build time checks the two agree,
// so a name added to one and forgotten in the other fails only at runtime, in
// the host nobody was testing — "x is not a function", after the bundle built
// cleanly.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Installed before the import: src/lib/browser.js resolves globalThis.chrome
// once at module evaluation, so a mock swapped in later would be ignored.
const state = { enabled: true, changeListeners: [], throwOnGet: false };
globalThis.chrome = {
  runtime: { getURL: (p) => `chrome-extension://abcdefgh/${p}`, sendMessage: async () => {} },
  storage: {
    sync: {
      async get() {
        if (state.throwOnGet) throw new Error('storage unavailable');
        return { enabled: state.enabled };
      },
    },
    onChanged: { addListener: (fn) => state.changeListeners.push(fn) },
  },
};

const host = await import('../src/pdf/host.js');
const mobile = await import('../src/pdf/host.mobile.js');

const fire = (changes, area = 'sync') => {
  for (const fn of state.changeListeners) fn(changes, area);
};

test('both hosts expose the same API surface', () => {
  assert.deepEqual(Object.keys(mobile).sort(), Object.keys(host).sort());
  for (const name of Object.keys(host)) {
    assert.equal(
      typeof mobile[name], typeof host[name],
      `${name} must be the same kind of export in both hosts`,
    );
  }
});

test('extension host reads the Convert pages setting', async () => {
  state.enabled = true;
  assert.equal(await host.conversionEnabled(), true);
  state.enabled = false;
  assert.equal(await host.conversionEnabled(), false);
});

test('extension host converts when the setting cannot be read', async () => {
  // Matching the content script: an unreadable store must not silently turn the
  // reform off, which would look like the extension having stopped working.
  state.throwOnGet = true;
  assert.equal(await host.conversionEnabled(), true);
  state.throwOnGet = false;
});

test('extension host reports changes to the setting, and only those', () => {
  const seen = [];
  host.onConversionChange((v) => seen.push(v));

  fire({ enabled: { newValue: false } });
  fire({ enabled: { newValue: true } });
  assert.deepEqual(seen, [false, true]);

  fire({ somethingElse: { newValue: 1 } });      // unrelated key
  fire({ enabled: { newValue: false } }, 'local'); // wrong storage area
  assert.deepEqual(seen, [false, true], 'neither must be reported');

  fire({ enabled: { newValue: undefined } });    // key removed → default on
  assert.deepEqual(seen, [false, true, true]);
});

test('mobile host always converts and has nothing to watch', async () => {
  assert.equal(await mobile.conversionEnabled(), true);
  let called = false;
  mobile.onConversionChange(() => { called = true; });
  fire({ enabled: { newValue: false } });
  assert.equal(called, false, 'a WebView host has no such setting');
});
