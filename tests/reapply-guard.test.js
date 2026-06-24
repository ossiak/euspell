import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateGuard } from '../src/content/reapply-guard.js';

test('rate guard: allows up to the limit, then freezes the node permanently', () => {
  let now = 0;
  const allow = createRateGuard({ windowMs: 1000, maxPerWindow: 3, now: () => now });
  const node = {};
  assert.equal(allow(node), true);   // 1
  assert.equal(allow(node), true);   // 2
  assert.equal(allow(node), true);   // 3
  assert.equal(allow(node), false);  // 4 — over the window limit -> frozen
  now = 5000;                        // a new window, but freezing is permanent
  assert.equal(allow(node), false);
});

test('rate guard: a slowly updating node never freezes (window keeps resetting)', () => {
  let now = 0;
  const allow = createRateGuard({ windowMs: 1000, maxPerWindow: 3, now: () => now });
  const clock = {};
  for (let i = 0; i < 25; i++) {
    assert.equal(allow(clock), true, `tick ${i}`);
    now += 1001; // one update per window
  }
});

test('rate guard: nodes are tracked independently', () => {
  let now = 0;
  const allow = createRateGuard({ windowMs: 1000, maxPerWindow: 1, now: () => now });
  const a = {}, b = {};
  assert.equal(allow(a), true);
  assert.equal(allow(a), false); // a frozen
  assert.equal(allow(b), true);  // b unaffected
});
