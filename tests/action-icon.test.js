// The toolbar on/off indicator. Exercises the real src/lib/action-icon.js
// against a mock extension API, and pins the artwork it names to files that
// exist and ship — setIcon reports a bad path only by doing nothing, so a typo
// or a missing entry in the Firefox copy list would surface as an icon that
// silently never changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ONE mock, installed before the module is loaded, then reconfigured per test.
// src/lib/browser.js resolves globalThis.chrome once at module evaluation and
// exports that binding, so swapping globalThis.chrome later would have no
// effect — the module under test would keep talking to the first mock.
const calls = { icons: [], titles: [], warnings: [] };
const cfg = { enabled: true, failSetIcon: false };
globalThis.chrome = {
  runtime: { getURL: (p) => `chrome-extension://abcdefgh/${p}` },
  action: {
    async setIcon(arg) {
      if (cfg.failSetIcon) throw new Error('Could not load icon');
      calls.icons.push(arg.path);
    },
    async setTitle(arg) { calls.titles.push(arg.title); },
  },
  storage: { sync: { async get() { return { enabled: cfg.enabled }; } } },
};

const { paintActionIcon, refreshActionIcon } = await import('../src/lib/action-icon.js');

function reset(next = {}) {
  calls.icons.length = 0;
  calls.titles.length = 0;
  calls.warnings.length = 0;
  Object.assign(cfg, { enabled: true, failSetIcon: false }, next);
}

/** Run `fn` with console.warn captured into calls.warnings. */
async function capturingWarnings(fn) {
  const warn = console.warn;
  console.warn = (...a) => calls.warnings.push(a.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.warn = warn;
  }
}

test('paints the normal mark when converting and the inverted one when off', async () => {
  reset();
  await paintActionIcon(true);
  assert.equal(calls.icons.at(-1)[16], 'chrome-extension://abcdefgh/icons/16.png');
  assert.match(calls.titles.at(-1), /converting/i);

  reset();
  await paintActionIcon(false);
  assert.equal(calls.icons.at(-1)[16], 'chrome-extension://abcdefgh/icons/16-off.png');
  assert.match(calls.titles.at(-1), /off/i);
});

test('every path is an absolute extension URL, in every size', async () => {
  // A relative path is resolved against the CALLING page, so 'icons/16-off.png'
  // becomes src/popup/icons/16-off.png from the popup — Chrome then reports
  // "Could not load action icon" and quietly leaves the previous artwork up,
  // which looks exactly like an indicator that does not work.
  for (const on of [true, false]) {
    reset();
    await paintActionIcon(on);
    const paths = calls.icons.at(-1);
    assert.deepEqual(Object.keys(paths).sort(), ['128', '16', '48']);
    for (const p of Object.values(paths)) {
      assert.match(p, /^chrome-extension:\/\//, `${p} must be absolute`);
    }
  }
});

test('refresh reads the stored setting', async () => {
  reset({ enabled: false });
  await refreshActionIcon();
  assert.match(calls.icons.at(-1)[16], /16-off\.png$/);

  reset({ enabled: true });
  await refreshActionIcon();
  assert.match(calls.icons.at(-1)[16], /16\.png$/);
});

test('a failed setIcon is reported, not swallowed', async () => {
  // An empty catch here is what made a stale icon undiagnosable the first time.
  reset({ failSetIcon: true });
  await capturingWarnings(() => paintActionIcon(false)); // must not throw
  assert.equal(calls.warnings.length, 1);
  assert.match(calls.warnings[0], /toolbar icon/i);
});

test('every named icon exists and ships in the Firefox build', () => {
  const src = fs.readFileSync(new URL('../src/lib/action-icon.js', import.meta.url), 'utf8');
  // The module names files through at('16-off.png'); the 'icons/' prefix lives
  // in that helper, so collect the arguments rather than whole paths.
  const paths = [...src.matchAll(/\bat\('([\w-]+\.png)'\)/g)].map((m) => `icons/${m[1]}`);
  assert.equal(paths.length, 6, 'both icon sets, three sizes each');

  const firefox = fs.readFileSync(new URL('../build/gen-firefox.js', import.meta.url), 'utf8');
  for (const p of paths) {
    assert.ok(fs.existsSync(new URL(`../${p}`, import.meta.url)), `${p} must exist (run npm run gen:icons)`);
    assert.ok(firefox.includes(`'${p}'`), `${p} must be in the Firefox copy list`);
  }
});
